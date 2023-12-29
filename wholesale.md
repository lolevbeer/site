---
layout: default
title: Wholesale
class: block no-snap wholesale
haslogin: True
---

Click beer names for more info.

<div v-cloak id="app">
  <table>
    <thead>
      <tr>
        <th>Beer</th>
        <th>Style</th>
        <th>1/2</th>
        <th>1/6</th>
        <th>Cases</th>
        <th>Tank</th>
        <th></th>
      </tr>
    </thead>
    <tbody>
      <template v-for="(item, index) in inventory">
        <tr>
          <td class="name"><a v-bind:href="'/beer/' + item.variant">${item.product}</a></td>
          <td class="beer-style">${ item.style }</td>
          <td data-column="1/2 Stock">${ item.halfs }</td>
          <td data-column="1/6 Stock">${ item.sixtels }</td>
          <td data-column="Case Stock">${ item.cases }</td>
          <td data-column="In Tank">${ item.tank }</td>
          <td>
            <a v-bind:id="'row-control-1' + index" class="row-control dots" title="More Info" target="_blank">
              <div class="dot"></div>
              <div class="dot"></div>
              <div class="dot"></div>
            </a>
          </td>
        </tr>
        <tr class="closed">
          <td class="inventory-pricing">Pricing</td>
          <td>Wholesale</td>
          <td v-if="item.halfs" data-column="1/2">${ item.wholesaleHalf }</td><td v-else></td>
          <td v-if="item.sixtels" data-column="1/6">${ item.wholesaleSixtel }</td><td v-else></td>
          <td v-if="item.cases" data-column="Case">${ item.wholesaleCase }</td><td v-else></td>
          <td><i></i></td>
          <td><i></i></td>
        </tr>
        <tr class="closed">
          <td><i></i></td>
          <td>Suggested Retail</td>
          <td v-if="item.halfs" data-column="1/2">${ item.suggRetailHalf }</td><td v-else></td>
          <td v-if="item.sixtels" data-column="1/6">${ item.suggRetailSixtel }</td><td v-else></td>
          <td v-if="item.cases" data-column="Case">${ item.suggRetailCase }</td><td v-else></td>
          <td><b>UPC</b>: ${ item.upc }</td>
          <td><i></i></td>
        </tr>
      </template>
    </tbody>
  </table>
</div>

Please contact [sales@lolev.beer](mailto:sales@lolev.beer) for questions.
