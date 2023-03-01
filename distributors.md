---
layout: default
title: Pricing
---

Click beer names for more info.

<table>
  <thead>
    <tr>
      <th>Beer</th>
      <th>1/2 Keg</th>
      <th>1/6 Keg</th>
      <th>Case</th>
      <th title="Suggested Retail Price">Sugg.</th>
    </tr>
  </thead>
  <tbody>
  {% for item in site.data.sales %}
    <tr>
      <td class="name"><a href="/beer/{{item.beer}}">{{item.beer}}</a></td>
      <td>
        {% if item.halfStock == 'TRUE' %}{{item.half}}
        {% else %}<s>{{item.half}}</s>{% endif %}
      </td>
      <td>
        {% if item.sixtelStock == 'TRUE' %}{{item.sixtel}}
        {% else %}<s>{{item.sixtel}}</s>{% endif %}
      </td>
      <td>
        {% if item.caseStock == 'TRUE' %}{{item.case}}
        {% else %}<s>{{item.case}}</s>{% endif %}
      </td>
      <td>{{item.retail}}</td>
    </tr>
  {% endfor %}
  </tbody>
</table>

Please contact [derek@lolev.beer](mailto:derek@lolev.beer) for orders.
