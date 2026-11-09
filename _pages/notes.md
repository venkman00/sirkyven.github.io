---
layout: page
title: All notes
permalink: /notes
---

Everything in the garden, newest first. Notes link to each other, and each note lists the ones that point back to it.

<ul class="note-list">
  {% assign notes = site.notes | where_exp: "n", "n.week == nil" | sort: "date" | reverse %}
  {% for note in notes %}
    <li>
      <time datetime="{{ note.date | date_to_xmlschema }}">{{ note.date | date: "%Y-%m-%d" }}</time>
      <a class="internal-link" href="{{ site.baseurl }}{{ note.url }}">{{ note.title }}</a>
    </li>
  {% endfor %}
</ul>
