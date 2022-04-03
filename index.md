---
layout: default
title: Test
---

{% for post in site.posts %}
<div>
  <a href="{{ post.url }}">
    <img class="blog-image" src="images/{{ post.image }}" />
    <h2>{{ post.title }}</h2>
  </a>
</div>
{% endfor %}

5247 Butler Street  
Lawrenceville, Pittsburgh
