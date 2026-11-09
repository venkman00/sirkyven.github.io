---
title: Concurrency in Java
date: 2025-02-22
tags: [java, concurrency]
viz: true
render_with_liquid: false
---

Concurrent code is hard to reason about because it's hard to *see*. A single-threaded program reads top to bottom. A concurrent one is several of those stories happening at once, and the bugs live in how they overlap.

Ivan Daniluk's [Visualizing Concurrency in Go](https://divan.dev/posts/go_concurrency_visualize/) has stuck with me for years. He traced real Go programs and drew each goroutine as a line falling through time, with arrows wherever they talked to each other. Patterns like fan-in or worker pools suddenly had a shape. This note borrows that idea for Java.

**How to read the diagrams.** Each vertical line is a thread, and time flows down. A solid blue line is a thread doing work, a red dotted line is a thread *blocked* on a lock, and a grey dotted line is a thread *waiting* (on a queue, a `join()`, a future). Arrows are hand-offs between threads. Shaded columns are things threads share: a variable, a lock, a queue. They play when you scroll to them; hit **Replay** to watch again.

These show one typical interleaving, not a trace. The real schedule changes from run to run, which is exactly the problem.

## Hello, concurrent world

The smallest concurrent program: `main` starts a second thread and waits for it.

```java
// inside main()
Thread worker = Thread.ofPlatform().name("worker")
        .start(() -> System.out.println("hello from worker"));

worker.join(); // main waits here until worker finishes
System.out.println("worker done");
```

<figure class="tviz">
<script type="application/json">
{
  "title": "main starts a worker thread and joins it",
  "T": 6,
  "lanes": [{"id": "main", "label": "main"}, {"id": "w", "label": "worker"}],
  "segments": [
    {"lane": "main", "from": 0, "to": 1.4, "state": "run"},
    {"lane": "main", "from": 1.4, "to": 4.6, "state": "wait", "label": "join()"},
    {"lane": "main", "from": 4.6, "to": 6, "state": "run"},
    {"lane": "w", "from": 1.2, "to": 4.2, "state": "run", "label": "println"}
  ],
  "arrows": [
    {"from": "main", "to": "w", "at": 1, "dt": 0.2, "kind": "spawn", "label": "start()"},
    {"from": "w", "to": "main", "at": 4.2, "dt": 0.3, "kind": "spawn", "label": "finished"}
  ],
  "marks": [{"lane": "main", "at": 4.8, "label": "join() returns", "kind": "ok"}]
}
</script>
<figcaption>Once <code>start()</code> runs, two stories run side by side. <code>join()</code> is the only thing that brings them back together.</figcaption>
</figure>

Everything else in this note is about what happens when those two lines need to touch the same thing.

## Race conditions

Two threads each increment a shared counter 100,000 times. You'd expect 200,000.

```java
class Counter {
    private int count = 0;
    void increment() { count++; } // read, add, write: 3 steps
    int get() { return count; }
}

Counter counter = new Counter();
Runnable task = () -> {
    for (int i = 0; i < 100_000; i++) counter.increment();
};
Thread t1 = Thread.ofPlatform().start(task);
Thread t2 = Thread.ofPlatform().start(task);
t1.join();
t2.join();
System.out.println(counter.get()); // usually less than 200000
```

`count++` looks like one operation but it's three: read the value, add one, write it back. If both threads read before either writes, one increment disappears.

<figure class="tviz">
<script type="application/json">
{
  "title": "Two threads lose an update to a shared counter",
  "T": 6.5,
  "lanes": [{"id": "t1", "label": "thread 1"}, {"id": "c", "label": "count", "kind": "resource", "sub": "shared int"}, {"id": "t2", "label": "thread 2"}],
  "segments": [
    {"lane": "t1", "from": 0.4, "to": 4, "state": "run"},
    {"lane": "t2", "from": 0.8, "to": 5, "state": "run"}
  ],
  "arrows": [
    {"from": "c", "to": "t1", "at": 1, "kind": "read", "label": "read 5"},
    {"from": "c", "to": "t2", "at": 1.7, "kind": "read", "label": "read 5"},
    {"from": "t1", "to": "c", "at": 3, "kind": "write", "label": "write 6"},
    {"from": "t2", "to": "c", "at": 4, "kind": "bad", "label": "write 6"}
  ],
  "marks": [{"lane": "c", "at": 5.6, "label": "2 increments, count = 6", "kind": "bad"}]
}
</script>
<figcaption>Thread 2 read the old value before thread 1 wrote the new one, so its write overwrites thread 1's work.</figcaption>
</figure>

The bug only appears when the reads and writes interleave like this, so it might pass a thousand test runs and fail in production.

## Locks: one thread at a time

`synchronized` turns the read-add-write into a critical section: only one thread can be inside it at a time. Everyone else blocks until the lock is free.

```java
class Counter {
    private int count = 0;
    synchronized void increment() { count++; }
    synchronized int get() { return count; }
}
```

<figure class="tviz">
<script type="application/json">
{
  "title": "Three threads take turns holding a lock",
  "T": 8.5,
  "lanes": [{"id": "t1", "label": "thread 1"}, {"id": "l", "label": "lock", "kind": "resource", "sub": "counter's monitor"}, {"id": "t2", "label": "thread 2"}, {"id": "t3", "label": "thread 3"}],
  "segments": [
    {"lane": "t1", "from": 0.3, "to": 2.8, "state": "run", "label": "count++"},
    {"lane": "t2", "from": 0.7, "to": 3.1, "state": "blocked", "label": "blocked"},
    {"lane": "t2", "from": 3.1, "to": 5.4, "state": "run", "label": "count++"},
    {"lane": "t3", "from": 1.1, "to": 5.7, "state": "blocked"},
    {"lane": "t3", "from": 5.7, "to": 8, "state": "run", "label": "count++"}
  ],
  "arrows": [
    {"from": "l", "to": "t1", "at": 0.3, "dt": 0.2, "kind": "msg", "label": "acquire"},
    {"from": "t1", "to": "l", "at": 2.8, "dt": 0.2, "kind": "msg", "label": "release"},
    {"from": "l", "to": "t2", "at": 3, "dt": 0.2, "kind": "msg"},
    {"from": "t2", "to": "l", "at": 5.3, "dt": 0.2, "kind": "msg"},
    {"from": "l", "to": "t3", "at": 5.5, "dt": 0.2, "kind": "msg"}
  ]
}
</script>
<figcaption>The lock passes from thread to thread. While one holds it, the others sit blocked (red) doing nothing.</figcaption>
</figure>

The diagram shows the cost: all that red is time threads spend waiting instead of working. So keep critical sections small, and reach for something lighter when you can:

- **Atomics.** `AtomicInteger.incrementAndGet()` does the read-add-write as one hardware operation, with no lock. For counters updated by many threads, `LongAdder` spreads the work out and is faster still.
- **Concurrent collections.** `ConcurrentHashMap` lets many threads read and write without one big lock. `map.merge(key, 1, Integer::sum)` is a thread-safe "increment this key".
- **Immutability.** An object that never changes after construction can be shared freely. Records and `final` fields get you most of the way.
- **`ReentrantLock`.** When you do need a lock but want more control, such as giving up after a timeout. Always release it in `finally`:

```java
lock.lock();
try {
    count++;
} finally {
    lock.unlock(); // runs even if the body throws
}
```

## Producer and consumer

A `BlockingQueue` lets threads hand work to each other without sharing variables directly. The queue does the waiting for you: `put()` waits while the queue is full, and `take()` waits while it's empty.

```java
// a queue that holds at most 2 items
BlockingQueue<Integer> queue = new ArrayBlockingQueue<>(2);

Thread producer = Thread.ofPlatform().start(() -> {
    try {
        for (int i = 1; i <= 3; i++) queue.put(i);
    } catch (InterruptedException e) {
        Thread.currentThread().interrupt();
    }
});

Thread consumer = Thread.ofPlatform().start(() -> {
    try {
        while (true) process(queue.take());
    } catch (InterruptedException e) {
        // consumer.interrupt() is how we stop it
        Thread.currentThread().interrupt();
    }
});
```

<figure class="tviz">
<script type="application/json">
{
  "title": "A producer and consumer share a bounded queue",
  "T": 9,
  "lanes": [{"id": "p", "label": "producer"}, {"id": "q", "label": "queue", "kind": "resource", "sub": "capacity 2"}, {"id": "c", "label": "consumer", "open": true}],
  "segments": [
    {"lane": "p", "from": 0.2, "to": 1.9, "state": "run"},
    {"lane": "p", "from": 1.9, "to": 3.4, "state": "wait", "label": "queue full"},
    {"lane": "p", "from": 3.4, "to": 4, "state": "run"},
    {"lane": "c", "from": 2.6, "to": 3.3, "state": "run"},
    {"lane": "c", "from": 3.3, "to": 4.6, "state": "run", "label": "process 1"},
    {"lane": "c", "from": 4.8, "to": 6, "state": "run", "label": "process 2"},
    {"lane": "c", "from": 6.2, "to": 7.4, "state": "run", "label": "process 3"},
    {"lane": "c", "from": 7.4, "to": 9, "state": "wait", "label": "queue empty"}
  ],
  "arrows": [
    {"from": "p", "to": "q", "at": 0.5, "kind": "msg", "label": "put 1"},
    {"from": "p", "to": "q", "at": 1.3, "kind": "msg", "label": "put 2"},
    {"from": "q", "to": "c", "at": 2.9, "kind": "msg", "label": "take 1"},
    {"from": "p", "to": "q", "at": 3.4, "kind": "msg", "label": "put 3"},
    {"from": "q", "to": "c", "at": 4.5, "kind": "msg", "label": "take 2"},
    {"from": "q", "to": "c", "at": 5.9, "kind": "msg", "label": "take 3"}
  ]
}
</script>
<figcaption>Both kinds of waiting in one picture: the producer parks while the queue is full, and the consumer parks once it's empty.</figcaption>
</figure>

Grey waiting is different from red blocking. A waiting thread has nothing to do yet, and the queue wakes it the moment there is. This back-pressure is the point of a *bounded* queue: a fast producer can't run away and fill memory.

## Worker pools

Creating a thread per task is expensive, and too many threads fight over the CPU. An `ExecutorService` keeps a fixed set of worker threads and feeds them tasks from a queue. This is the fan-out pattern.

```java
try (ExecutorService pool = Executors.newFixedThreadPool(3)) {
    List<Future<Result>> futures = new ArrayList<>();
    for (Task task : tasks) {
        futures.add(pool.submit(() -> handle(task)));
    }
    for (Future<Result> f : futures) {
        results.add(f.get()); // wait for each result in turn
    }
} // close() waits for running tasks, then shuts the pool down
```

<figure class="tviz">
<script type="application/json">
{
  "title": "Six tasks fan out to a pool of three workers",
  "T": 9,
  "lanes": [{"id": "m", "label": "main"}, {"id": "q", "label": "tasks", "kind": "resource", "sub": "work queue"}, {"id": "w1", "label": "worker 1"}, {"id": "w2", "label": "worker 2"}, {"id": "w3", "label": "worker 3"}],
  "segments": [
    {"lane": "m", "from": 0, "to": 1, "state": "run"},
    {"lane": "m", "from": 1, "to": 7.8, "state": "wait", "label": "f.get()"},
    {"lane": "m", "from": 7.8, "to": 9, "state": "run"},
    {"lane": "w1", "from": 0.6, "to": 2.8, "state": "run", "label": "t1"},
    {"lane": "w1", "from": 3.1, "to": 5, "state": "run", "label": "t4"},
    {"lane": "w1", "from": 5, "to": 8.2, "state": "wait"},
    {"lane": "w2", "from": 0.9, "to": 3.8, "state": "run", "label": "t2"},
    {"lane": "w2", "from": 4.1, "to": 6.4, "state": "run", "label": "t5"},
    {"lane": "w2", "from": 6.4, "to": 8.2, "state": "wait"},
    {"lane": "w3", "from": 1.2, "to": 2.3, "state": "run", "label": "t3"},
    {"lane": "w3", "from": 2.6, "to": 7.6, "state": "run", "label": "t6"},
    {"lane": "w3", "from": 7.6, "to": 8.2, "state": "wait"}
  ],
  "arrows": [
    {"from": "m", "to": "q", "at": 0.1, "dt": 0.2, "kind": "msg", "label": "submit 6"},
    {"from": "q", "to": "w1", "at": 0.4, "dt": 0.2, "kind": "msg"},
    {"from": "q", "to": "w2", "at": 0.7, "dt": 0.2, "kind": "msg"},
    {"from": "q", "to": "w3", "at": 1, "dt": 0.2, "kind": "msg"},
    {"from": "q", "to": "w3", "at": 2.4, "dt": 0.2, "kind": "msg"},
    {"from": "q", "to": "w1", "at": 2.9, "dt": 0.2, "kind": "msg"},
    {"from": "q", "to": "w2", "at": 3.9, "dt": 0.2, "kind": "msg"}
  ],
  "marks": [{"lane": "m", "at": 8, "label": "all results in", "kind": "ok"}]
}
</script>
<figcaption>Whichever worker frees up first takes the next task. Worker 3 happened to get the long task (t6), so the others finish early and idle.</figcaption>
</figure>

Two things the picture makes obvious. The pool size caps parallelism, no matter how many tasks you submit. And the whole job is only as fast as its slowest task: everyone waits on t6.

## Deadlock

Each thread needs two locks, and they grab them in opposite orders.

```java
// thread 1                       // thread 2
synchronized (a) {                synchronized (b) {
    synchronized (b) { ... }          synchronized (a) { ... }
}                                 }
```

<figure class="tviz">
<script type="application/json">
{
  "title": "Two threads deadlock by taking two locks in opposite order",
  "T": 7,
  "lanes": [{"id": "t1", "label": "thread 1", "open": true}, {"id": "a", "label": "lock a", "kind": "resource"}, {"id": "b", "label": "lock b", "kind": "resource"}, {"id": "t2", "label": "thread 2", "open": true}],
  "segments": [
    {"lane": "t1", "from": 0.3, "to": 2.2, "state": "run", "label": "holds a"},
    {"lane": "t1", "from": 2.2, "to": 7, "state": "blocked", "label": "needs b"},
    {"lane": "t2", "from": 0.6, "to": 2.7, "state": "run", "label": "holds b"},
    {"lane": "t2", "from": 2.7, "to": 7, "state": "blocked", "label": "needs a"}
  ],
  "arrows": [
    {"from": "a", "to": "t1", "at": 0.3, "dt": 0.2, "kind": "msg", "label": "acquire"},
    {"from": "b", "to": "t2", "at": 0.6, "dt": 0.2, "kind": "msg", "label": "acquire"},
    {"from": "t1", "to": "b", "at": 2, "dt": 0.3, "kind": "bad", "label": "wants b"},
    {"from": "t2", "to": "a", "at": 2.5, "dt": 0.3, "kind": "bad", "label": "wants a"}
  ],
  "marks": [{"lane": "a", "at": 5, "label": "deadlock: forever", "kind": "bad"}]
}
</script>
<figcaption>Each thread holds the lock the other needs. Neither line ever ends: no exception, no error, just two threads stuck.</figcaption>
</figure>

The two red arrows point at each other: that cycle is the bug. The fix is to make sure a cycle can't form:

- **Lock in a consistent order.** If every thread takes `a` before `b`, the cycle can't form.
- **Give up instead of waiting forever.** `tryLock` with a timeout turns a hang into something you can retry or report:

```java
if (a.tryLock(1, TimeUnit.SECONDS)) {
    try {
        if (b.tryLock(1, TimeUnit.SECONDS)) {
            try { transfer(); } finally { b.unlock(); }
        }
    } finally {
        a.unlock();
    }
}
```

When a service hangs, take a thread dump (`jcmd <pid> Thread.print` or `jstack <pid>`). The JVM detects these cycles and prints "Found one Java-level deadlock" with both threads and the locks they hold.

## Visibility and `volatile`

Not every concurrency bug is about two writes colliding. Sometimes one thread writes and the other simply never sees it.

```java
class Worker implements Runnable {
    private volatile boolean running = true;

    public void run() {
        while (running) {
            doWork();
        }
    }

    // called from another thread
    public void stop() { running = false; }
}
```

<figure class="tviz">
<script type="application/json">
{
  "title": "A worker loop sees a volatile flag change and stops",
  "T": 6.5,
  "lanes": [{"id": "m", "label": "main"}, {"id": "f", "label": "running", "kind": "resource", "sub": "volatile boolean"}, {"id": "w", "label": "worker", "sub": "while (running)"}],
  "segments": [
    {"lane": "m", "from": 0, "to": 4.4, "state": "run"},
    {"lane": "w", "from": 0.4, "to": 5.1, "state": "run"}
  ],
  "arrows": [
    {"from": "f", "to": "w", "at": 0.7, "dt": 0.15, "kind": "read", "label": "true"},
    {"from": "f", "to": "w", "at": 1.6, "dt": 0.15, "kind": "read", "label": "true"},
    {"from": "f", "to": "w", "at": 2.5, "dt": 0.15, "kind": "read", "label": "true"},
    {"from": "m", "to": "f", "at": 3.1, "dt": 0.2, "kind": "write", "label": "stop(): false"},
    {"from": "f", "to": "w", "at": 3.4, "dt": 0.15, "kind": "read"},
    {"from": "f", "to": "w", "at": 4.6, "dt": 0.15, "kind": "read", "label": "false"}
  ],
  "marks": [{"lane": "w", "at": 5.4, "label": "loop exits", "kind": "ok"}]
}
</script>
<figcaption>With <code>volatile</code>, every check reads the real value, so the worker sees <code>false</code> on its next pass.</figcaption>
</figure>

Without `volatile`, the JIT is allowed to read `running` once and keep using a cached copy, so the worker's arrows would never pick up the write and the loop would spin forever. `volatile` guarantees visibility, not atomicity: `volatile int count; count++` is still the race from earlier.

For stopping threads, prefer the built-in signal: `thread.interrupt()`, checked with `Thread.currentThread().isInterrupted()`. Blocking calls like `sleep`, `take` and `join` already respond to it by throwing `InterruptedException`. Never use `Thread.stop()`: it was always unsafe, and since Java 20 it just throws `UnsupportedOperationException`.

## Virtual threads

Java 21's virtual threads are the closest thing Java has to goroutines. They're cheap enough to create one per task, even millions. The JVM runs them on a few ordinary *carrier* threads. When a virtual thread blocks on I/O or `sleep`, it unmounts from its carrier, and another virtual thread runs there instead.

```java
try (var executor =
        Executors.newVirtualThreadPerTaskExecutor()) {
    for (int i = 0; i < 10_000; i++) {
        int id = i;
        executor.submit(() -> {
            // parks; the carrier picks up other work
            Thread.sleep(Duration.ofSeconds(1));
            return id;
        });
    }
} // 10,000 one-second sleeps finish in about a second
```

<figure class="tviz">
<script type="application/json">
{
  "title": "Virtual threads take turns on two carrier threads",
  "T": 7.6,
  "lanes": [{"id": "c1", "label": "carrier 1", "sub": "platform thread"}, {"id": "p", "label": "parked", "kind": "resource", "sub": "waiting on I/O"}, {"id": "c2", "label": "carrier 2", "sub": "platform thread"}],
  "segments": [
    {"lane": "c1", "from": 0.2, "to": 1.5, "state": "run", "label": "v1"},
    {"lane": "c1", "from": 1.7, "to": 2.7, "state": "run", "label": "v3"},
    {"lane": "c1", "from": 2.9, "to": 4.3, "state": "run", "label": "v1 (resumed)"},
    {"lane": "c1", "from": 4.5, "to": 5.2, "state": "run", "label": "v5"},
    {"lane": "c1", "from": 5.4, "to": 7.2, "state": "run", "label": "v3 (resumed)"},
    {"lane": "c2", "from": 0.2, "to": 1.2, "state": "run", "label": "v2"},
    {"lane": "c2", "from": 1.4, "to": 2.9, "state": "run", "label": "v4"},
    {"lane": "c2", "from": 3.1, "to": 4.1, "state": "run", "label": "v2 (resumed)"},
    {"lane": "c2", "from": 4.3, "to": 5.7, "state": "run", "label": "v4 (resumed)"},
    {"lane": "c2", "from": 5.9, "to": 7.3, "state": "run", "label": "v5 (resumed)"}
  ],
  "arrows": [
    {"from": "c2", "to": "p", "at": 1.2, "kind": "msg", "label": "v2 blocks"},
    {"from": "c1", "to": "p", "at": 1.5, "kind": "msg", "label": "v1 blocks"},
    {"from": "c1", "to": "p", "at": 2.7, "kind": "msg", "label": "v3 blocks"},
    {"from": "c2", "to": "p", "at": 2.9, "kind": "msg", "label": "v4 blocks"},
    {"from": "c1", "to": "p", "at": 5.2, "kind": "msg", "label": "v5 blocks"},
    {"from": "p", "to": "c2", "at": 5.5, "kind": "msg", "label": "v5 ready"}
  ]
}
</script>
<figcaption>Five virtual threads share two carriers. Whenever one blocks, it parks and frees its carrier for another, so the carriers never sit idle.</figcaption>
</figure>

Compare this with the worker pool. There, a blocked task ties up one of three threads. Here, blocking costs almost nothing, so you can write plain blocking code (`sleep`, JDBC calls, HTTP requests) and still handle huge numbers of concurrent tasks. Two caveats: virtual threads help with waiting, not CPU-heavy work, which still needs real cores. And on Java 21–23, blocking inside a `synchronized` block *pins* the virtual thread to its carrier; use `ReentrantLock` there, or upgrade to Java 24, which fixed it.

## Seeing your own threads

These diagrams are hand-drawn. For real programs, Java can draw them for you. Record with JDK Flight Recorder (`java -XX:StartFlightRecording=filename=rec.jfr ...`) and open the file in JDK Mission Control: its thread view shows one lane per thread, colored by running, blocked and waiting, much like the pictures above. For correctness rather than timing, [jcstress](https://github.com/openjdk/jcstress) runs tiny concurrent tests millions of times to shake out rare interleavings like the lost update.

## Takeaways

- **Share less.** Every arrow into a shared column is a place things can go wrong. Immutable objects and message passing through queues remove arrows entirely.
- **When you must share, use the right tool.** Atomics for counters, concurrent collections for maps and queues, locks for everything else, held as briefly as possible.
- **Red means waste.** Lots of blocked time means a lock is too coarse or held too long.
- **Lock in one order** and prefer timeouts, so the arrows never form a cycle.
- **`volatile` is for visibility only**, not for making `count++` safe.
- **Use pools or virtual threads** instead of creating threads by hand: pools for CPU-bound work, virtual threads for I/O-bound work.
- **Test like the bug is rare, because it is.** Stress tests, jcstress, and thread dumps catch what a single test run won't.

*The visual approach is borrowed from Ivan Daniluk's [Visualizing Concurrency in Go](https://divan.dev/posts/go_concurrency_visualize/). First drafted with Grok in February 2025; rewritten in November 2026.*
