var pym = require("./lib/pym");
var ANALYTICS = require("./lib/analytics");
require("./lib/webfonts");
var { isMobile } = require("./lib/breakpoints");

var d3 = {
  ...require("d3-array"),
  ...require("d3-axis"),
  ...require("d3-scale"),
  ...require("d3-selection")
};

var pymChild = null;
pym.then(function(child) {

  pymChild = child;
  child.sendHeight();
  window.addEventListener("resize", render);

  child.onMessage("on-screen", function(bucket) {
    ANALYTICS.trackEvent("on-screen", bucket);
  });
  child.onMessage("scroll-depth", function(data) {
    data = JSON.parse(data);
    ANALYTICS.trackEvent("scroll-depth", data.percent, data.seconds);
  });

});

var render = function() {
  var container = document.querySelector(".graphic");
  //remove fallback
  container.innerHTML = "";
  var containerWidth = container.offsetWidth;

  var $container = d3.select(container);
  var svg = container.append("svg");

  //put your D3 code here

  pymChild.sendHeight();
};

//first render
render();