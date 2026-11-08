---
title: Concurrency in Java
date: 2025-02-22
tags: [java, concurrency]
---

> Drafted with Grok.


Concurrency in Java enables multiple tasks to run simultaneously, enhancing application performance and responsiveness. Java offers robust tools for concurrency through threads, the `java.util.concurrent` package, and synchronization mechanisms. However, concurrency introduces challenges like race conditions and deadlocks, making it essential to follow best practices. In this blog post, we’ll explore these practices with clear explanations and practical code examples formatted in Markdown.

## Introduction to Concurrency in Java

Concurrency refers to executing multiple tasks at the same time, leveraging threads in Java—lightweight processes that run in parallel. This capability is crucial for utilizing multi-core processors, improving resource efficiency, and enhancing responsiveness in applications handling multiple tasks or user requests.

However, concurrency comes with pitfalls:
- **Race conditions**: Unpredictable outcomes when threads access shared data simultaneously.
- **Deadlocks**: Threads waiting indefinitely for each other to release resources.
- **Memory visibility**: Changes by one thread not visible to others without proper synchronization.

Let’s dive into best practices to manage these issues effectively.

## Synchronizing Access to Shared Resources

When multiple threads access shared data, synchronization ensures data consistency by controlling access.

### Using Synchronization

The `synchronized` keyword ensures that only one thread executes a method or block at a time, preventing race conditions.

**Example: Race Condition Without Synchronization**

Here’s a counter class where threads increment a shared variable:

```java
public class Counter {
    private int count = 0;

    public void increment() {
        count++;  // Not thread-safe
    }

    public int getCount() {
        return count;
    }

    public static void main(String[] args) throws InterruptedException {
        Counter counter = new Counter();
        Runnable task = () -> { for (int i = 0; i < 1000; i++) counter.increment(); };
        Thread t1 = new Thread(task);
        Thread t2 = new Thread(task);
        t1.start();
        t2.start();
        t1.join();
        t2.join();
        System.out.println("Final count: " + counter.getCount());  // Expected: 2000, Actual: Varies
    }
}
```

Running this may yield a `count` less than 2000 due to race conditions—`count++` isn’t atomic, and threads interleave operations.

**Fixing with Synchronization**

Add `synchronized` to ensure thread safety:

```java
public class Counter {
    private int count = 0;

    public synchronized void increment() {
        count++;
    }

    public int getCount() {
        return count;
    }

    public static void main(String[] args) throws InterruptedException {
        Counter counter = new Counter();
        Runnable task = () -> { for (int i = 0; i < 1000; i++) counter.increment(); };
        Thread t1 = new Thread(task);
        Thread t2 = new Thread(task);
        t1.start();
        t2.start();
        t1.join();
        t2.join();
        System.out.println("Final count: " + counter.getCount());  // Always 2000
    }
}
```

Now, the method is thread-safe, and the count is accurate.

**Best Practice**: Keep synchronized blocks small to minimize performance overhead.

### Using Locks

The `Lock` interface (e.g., `ReentrantLock`) offers more flexibility than `synchronized`, such as non-blocking lock attempts.

**Example: Using `ReentrantLock`**

```java
import java.util.concurrent.locks.Lock;
import java.util.concurrent.locks.ReentrantLock;

public class Counter {
    private int count = 0;
    private Lock lock = new ReentrantLock();

    public void increment() {
        lock.lock();
        try {
            count++;
        } finally {
            lock.unlock();  // Unlock in finally to ensure release
        }
    }

    public int getCount() {
        return count;
    }
}
```

**Best Practice**: Always unlock in a `finally` block to prevent lock retention if exceptions occur.

### Concurrent Collections

Use thread-safe collections like `ConcurrentHashMap` from `java.util.concurrent` instead of non-thread-safe ones like `HashMap`.

**Example: Using `ConcurrentHashMap`**

```java
import java.util.concurrent.ConcurrentHashMap;
import java.util.Map;

public class ConcurrentMapExample {
    public static void main(String[] args) throws InterruptedException {
        Map<String, Integer> map = new ConcurrentHashMap<>();
        Runnable task = () -> {
            for (int i = 0; i < 100; i++) {
                map.put(Thread.currentThread().getName() + i, i);
            }
        };
        Thread t1 = new Thread(task);
        Thread t2 = new Thread(task);
        t1.start();
        t2.start();
        t1.join();
        t2.join();
        System.out.println("Map size: " + map.size());
    }
}
```

This safely handles concurrent modifications without explicit synchronization.

**Best Practice**: Prefer concurrent collections for multi-threaded data sharing.

## Designing for Concurrency

Design choices can simplify concurrency and enhance scalability.

### Immutability

Immutable objects, whose state cannot change after creation, are naturally thread-safe.

**Example: Immutable Class**

```java
public final class ImmutablePoint {
    private final int x;
    private final int y;

    public ImmutablePoint(int x, int y) {
        this.x = x;
        this.y = y;
    }

    public int getX() { return x; }
    public int getY() { return y; }
}
```

No synchronization is needed when sharing `ImmutablePoint` across threads.

**Best Practice**: Use immutability to reduce synchronization needs.

### Using ExecutorService

The `ExecutorService` framework simplifies thread management with thread pools, avoiding manual thread creation.

**Example: Using `ExecutorService`**

```java
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class ExecutorServiceExample {
    public static void main(String[] args) {
        ExecutorService executor = Executors.newFixedThreadPool(2);
        for (int i = 0; i < 5; i++) {
            final int taskId = i;
            executor.submit(() -> {
                System.out.println("Task " + taskId + " by " + Thread.currentThread().getName());
            });
        }
        executor.shutdown();
    }
}
```

This runs five tasks across two threads efficiently.

**Best Practice**: Use `ExecutorService` for task execution and thread pooling.

## Common Pitfalls and How to Avoid Them

Concurrency introduces subtle bugs; here’s how to sidestep them.

### Race Conditions

Addressed earlier, use synchronization, locks, or atomic variables like `AtomicInteger`.

**Example: Using `AtomicInteger`**

```java
import java.util.concurrent.atomic.AtomicInteger;

public class AtomicExample {
    private AtomicInteger count = new AtomicInteger(0);

    public void increment() {
        count.incrementAndGet();
    }

    public int getCount() {
        return count.get();
    }
}
```

**Best Practice**: Use atomic variables for simple, thread-safe operations.

### Deadlocks

Deadlocks occur when threads wait cyclically for resources.

**Example: Deadlock**

```java
public class DeadlockExample {
    private static final Object lock1 = new Object();
    private static final Object lock2 = new Object();

    public static void main(String[] args) {
        Thread t1 = new Thread(() -> {
            synchronized (lock1) {
                try { Thread.sleep(100); } catch (Exception e) {}
                synchronized (lock2) { System.out.println("T1 done"); }
            }
        });
        Thread t2 = new Thread(() -> {
            synchronized (lock2) {
                synchronized (lock1) { System.out.println("T2 done"); }
            }
        });
        t1.start();
        t2.start();
    }
}
```

**Avoidance**: Acquire locks in a consistent order or use `tryLock()` with timeouts.

### Using Volatile Correctly

The `volatile` keyword ensures variable visibility across threads but not atomicity.

**Example: Volatile Flag**

```java
public class VolatileExample {
    private volatile boolean running = true;

    public void start() {
        new Thread(() -> {
            while (running) { /* Work */ }
            System.out.println("Stopped");
        }).start();
    }

    public void stop() {
        running = false;
    }
}
```

**Best Practice**: Use `volatile` for visibility, not for atomic operations.

### Avoiding Deprecated Methods

Avoid `Thread.stop()`, `suspend()`, and `resume()`—they’re unsafe. Use flags or interruption instead.

## Testing Concurrent Code

Concurrency bugs are non-deterministic. Use:
- JUnit with multi-threading support.
- Tools like `Thread Weaver`.
- Stress testing under high load.

**Best Practice**: Rigorously test under varied conditions.

## Conclusion

Concurrency in Java boosts performance but demands careful design. Key takeaways:
- Use `ConcurrentHashMap` and similar collections.
- Limit synchronization scope.
- Embrace immutability.
- Leverage `ExecutorService`.
- Apply `volatile` appropriately.
- Prevent deadlocks with consistent lock ordering.
- Test thoroughly.

By adopting these practices, you’ll build robust, efficient, and thread-safe Java applications.

--- 

This blog post provides a practical guide to concurrency in Java, enriched with readable code examples and formatted for clarity using Markdown. Follow these best practices to master concurrent programming!
