---
layout: page
title: Home
id: home
permalink: /
---

Hi, I'm Venky. I'm a software engineer learning machine learning and systems from first principles. This is my [[About|digital garden]]: notes I keep coming back to and expanding over time. Some are finished, most are still growing.

## Notes

<ul class="note-list">
  {% assign notes = site.notes | sort: "date" | reverse %}
  {% for note in notes %}
    <li>
      <time datetime="{{ note.date | date_to_xmlschema }}">{{ note.date | date: "%b %Y" }}</time>
      <a class="internal-link" href="{{ site.baseurl }}{{ note.url }}">{{ note.title }}</a>
    </li>
  {% endfor %}
</ul>
