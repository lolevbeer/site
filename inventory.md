---
layout: default
title: Pricing
class: block
---

Click beer names for more info.

<table>
  <thead>
    <tr>
      <th>Beer</th>
      <th>Halfs</th>
      <th>Sixtels</th>
      <th>Cases</th>
      <th>Tank</th>
      <th>UPC</th>
    </tr>
  </thead>
  <tbody>
  {% for item in site.data.sales %}
    {% if item.displayed == 'TRUE' %}
      <tr>
        <td class="name">
          {{item.beer}}
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
    {% endif %}
  {% endfor %}
  </tbody>
</table>

Please contact [sales@lolev.beer](mailto:sales@lolev.beer) for pre-orders or other questions.
