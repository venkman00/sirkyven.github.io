---
layout: page
title: Home
id: home
permalink: /
---

Hi, I'm Venky. I'm a software engineer learning machine learning and systems from first principles. This is my [[About|digital garden]]: notes I keep coming back to and expanding over time. Some are finished, most are still growing.

{% assign weeks = site.notes | where_exp: "n", "n.week" | sort: "date" | reverse %}
{% if weeks.size > 0 %}{% assign w = weeks.first %}
I keep a [weekly log](/log) of what I try and learn each day. Latest: [{{ w.title }}]({{ site.baseurl }}{{ w.url }}).
{% endif %}

## Notes

<ul class="note-list">
  {% assign notes = site.notes | where_exp: "n", "n.week == nil" | sort: "date" | reverse %}
  {% for note in notes %}
    <li>
      <time datetime="{{ note.date | date_to_xmlschema }}">{{ note.date | date: "%b %Y" }}</time>
      <a class="internal-link" href="{{ site.baseurl }}{{ note.url }}">{{ note.title }}</a>
    </li>
  {% endfor %}
</ul>

<p class="small"><a class="internal-link" href="{{ site.baseurl }}/notes">All notes and the weekly log →</a></p>
