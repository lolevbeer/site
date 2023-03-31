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
      <td class="name"><a class="btn" href="/beer/{{item.variant}}">{{item.beer}}</a></td>
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

[Order Here](https://docs.google.com/forms/d/e/1FAIpQLScpSY7L4Eh4_OucI8Cz1qcKFxQaWzazIoeQ__WhTKsMB6_S5w/viewform?usp=sf_link){: .btn .sales target="_blank"}

Please contact [sales@lolev.beer](mailto:sales@lolev.beer) for pre-orders or other questions.
