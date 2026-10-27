/**
 * Google Analytics 4 for the public site.
 *
 * The gtag.js loader (~180 KB, ~300 ms of main-thread time on a mid-range
 * phone) is fetched on the visitor's first input, or after a few seconds if
 * none comes, instead of during page load. `window.gtag` and the dataLayer
 * queue exist from the first byte, so anything tracked before the script
 * arrives is queued, not dropped; the page_view fires when gtag.js loads.
 *
 * Google signals and ad personalization are off. This property is linked to a
 * Google Ads account, and with them on gtag fires a DoubleClick conversion
 * ping that sets a third-party cookie on every page view.
 */

export const GA_ID = 'G-RR14DE5FPS'

/** Milliseconds to wait for a first input before loading gtag.js anyway. */
const FALLBACK_DELAY_MS = 5000

const INPUT_EVENTS = ['pointerdown', 'pointermove', 'keydown', 'touchstart', 'scroll']

/** Inline loader: queue + config now, the script tag on first input. */
export const GA_LOADER = `
window.dataLayer=window.dataLayer||[];
window.gtag=function(){window.dataLayer.push(arguments)};
gtag('js',new Date());
gtag('config','${GA_ID}',{allow_google_signals:false,allow_ad_personalization_signals:false});
(function(){
var events=${JSON.stringify(INPUT_EVENTS)};
var timer=setTimeout(load,${FALLBACK_DELAY_MS});
function load(){
clearTimeout(timer);
events.forEach(function(e){removeEventListener(e,load,true)});
var s=document.createElement('script');
s.async=true;
s.src='https://www.googletagmanager.com/gtag/js?id=${GA_ID}';
document.head.appendChild(s);
}
events.forEach(function(e){addEventListener(e,load,{capture:true,passive:true})});
})();
`.trim()

export function GoogleAnalytics() {
  // A plain script tag runs during HTML parsing, before hydration, so it can
  // catch the very first input; next/script would wait for hydration.
  return <script id="google-analytics" dangerouslySetInnerHTML={{ __html: GA_LOADER }} />
}
