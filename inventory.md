---
layout: default
title: Inventory
class: block
---

Click beer names for more info.

<table>
  <thead>
    <tr>
      <th>Beer</th>
      <th>Style</th>
      <th>Halfs</th>
      <th>Sixtels</th>
      <th>Cases</th>
      <th>Tank</th>
      <th>UPC</th>
    </tr>
  </thead>
  <tbody>
  {% for item in site.data.inventory %}
    <tr>
      <td class="name">
        <a href="/beer/{{item.variant}}">{{item.product}}</a>
      </td>
      <td data-column="Style">
        {% if item.style %}
          {{item.style}}
        {% endif %}
      </td>
      <td data-column="Halfs">
        {% if item.halfs %}
          {{item.halfs}}
        {% endif %}
      </td>
      <td data-column="Sixtels">
        {% if item.sixtels %}
          {{item.sixtels}}
        {% endif %}
      </td>
      <td data-column="Cases">
        {% if item.cases %}
          {{item.cases}}
        {% endif %}
      </td>
      <td data-column="Tank">
        {% if item.tank %}
          {{item.tank}}
        {% endif %}
      </td>
      <td data-column="UPC">
        {% if item.upc %}
          {{item.upc}}
        {% endif %}
      </td>
    </tr>
  {% endfor %}
  </tbody>
</table>

Please contact [sales@lolev.beer](mailto:sales@lolev.beer) for pre-orders or other questions.
