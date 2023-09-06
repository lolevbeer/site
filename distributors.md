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
      <th>Style</th>
      <th>Half</th>
      <th>Sixtel</th>
      <th>Case</th>
    </tr>
  </thead>
  <tbody>
  {% for item in site.data.sales %}
    {% if item.displayed == 'TRUE' %}
      <tr>
        <td class="name">
          <a class="btn" href="/beer/{{item.variant}}">{{item.beer}}</a>
        </td>
        <td>
          {% if item.style %}
            {{item.style}}
          {% endif %}
        </td>
        <td data-column="Half">
          {% if item.halfStock == 'TRUE' %}
            {{item.half}}
          {% else %}<s>{{item.case}}</s>{% endif %}
        </td>
        <td data-column="Sixtel">
          {% if item.sixtelStock == 'TRUE' %}
            {{item.sixtel}}
          {% else %}<s>{{item.case}}</s>{% endif %}
        </td>
        <td data-column="Case">
          {% if item.caseStock == 'TRUE' %}
            {{item.case}}
          {% else %}<s>{{item.case}}</s>{% endif %}
        </td>
      </tr>
    {% endif %}
  {% endfor %}
  </tbody>
</table>

Please contact [sales@lolev.beer](mailto:sales@lolev.beer) for pre-orders or other questions.
