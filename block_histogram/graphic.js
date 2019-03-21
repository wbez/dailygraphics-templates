var pym = require("./lib/pym");
var ANALYTICS = require("./lib/analytics");
require("./lib/webfonts");
var { isMobile } = require("./lib/breakpoints");

// Global config
var COLOR_BINS = [-4, -2, 0, 2, 4, 6, 8, 10];
var COLOR_RANGE = [
  "#e68c31",
  "#eba934",
  "#efc637",
  "#c6b550",
  "#99a363",
  "#6a9171",
  "#17807e"
];

// Global vars
var pymChild = null;
var binnedData = [];

var d3 = {
  ...require("d3-selection/dist/d3-selection.min"),
  ...require("d3-scale/dist/d3-scale.min"),
  ...require("d3-axis/dist/d3-axis.min")
};

var { makeTranslate, classify } = require("./lib/helpers");

// Initialize the graphic.
var onWindowLoaded = function() {
  formatData();
  render();

  window.addEventListener("resize", render);

  pym.then(child => {
    pymChild = child;
    pymChild.sendHeight();

    pymChild.onMessage("on-screen", function(bucket) {
      ANALYTICS.trackEvent("on-screen", bucket);
    });
    pymChild.onMessage("scroll-depth", function(data) {
      data = JSON.parse(data);
      ANALYTICS.trackEvent("scroll-depth", data.percent, data.seconds);
    });
  });
};

// Format graphic data for processing by D3.
var formatData = function() {
  var numBins = COLOR_BINS.length - 1;

  // init the bins
  for (var i = 0; i < numBins; i++) {
    binnedData[i] = [];
  }

  // put states in bins
  DATA.forEach(function(d) {
    if (d.amt != null) {
      var state = d.usps;

      for (var i = 0; i < numBins; i++) {
        if (amt >= COLOR_BINS[i] && amt < COLOR_BINS[i + 1]) {
          binnedData[i].unshift(state);
          break;
        }
      }
    }
  });
};

// Render the graphic(s). Called by pym with the container width.
var render = function() {
  // Render the chart!
  var container = "#block-histogram";
  var element = document.querySelector(container);
  var width = element.offsetWidth;
  renderBlockHistogram({
    container,
    width,
    data: binnedData,
    bins: COLOR_BINS,
    colors: COLOR_RANGE
  });

  // Update iframe
  if (pymChild) {
    pymChild.sendHeight();
  }
};

// Render a bar chart.
var renderBlockHistogram = function(config) {
  // Setup
  var labelColumn = "usps";
  var valueColumn = "amt";

  var blockHeight = 30;
  if (isMobile.matches) {
    blockHeight = 18;
  }
  var blockGap = 1;

  var margins = {
    top: 20,
    right: 12,
    bottom: 20,
    left: 10
  };

  var ticksY = 4;

  // Determine largest bin
  var largestBin = Math.max.apply(
    null,
    binnedData.map(b => b.length)
  );

  // Calculate actual chart dimensions
  var chartWidth = config.width - margins.left - margins.right;
  var chartHeight = (blockHeight + blockGap) * largestBin;

  // Clear existing graphic (for redraw)
  var containerElement = d3.select(config.container);
  containerElement.html("");

  // Create the root SVG element.
  var chartWrapper = containerElement
    .append("div")
    .attr("class", "graphic-wrapper");

  var chartElement = chartWrapper
    .append("svg")
    .attr("width", chartWidth + margins.left + margins.right)
    .attr("height", chartHeight + margins.top + margins.bottom)
    .append("g")
    .attr("transform", makeTranslate(margins.left, margins.top));

  // Create D3 scale objects.
  var xScale = d3
    .scaleBand()
    .domain(config.bins.slice(0, -1))
    .range([0, chartWidth])
    .padding(0.1);

  var yScale = d3
    .scaleLinear()
    .domain([0, largestBin])
    .range([chartHeight, 0]);

  // Create D3 axes.
  var xAxis = d3
    .axisBottom()
    .scale(xScale)
    .tickFormat(d => d > 0 ? "+" + d + "%" : d + "%");

  var yAxis = d3
    .axisLeft()
    .scale(yScale)
    .ticks(ticksY);

  // Render axes to chart.
  chartElement
    .append("g")
    .attr("class", "x axis")
    .attr("transform", makeTranslate(0, chartHeight))
    .call(xAxis);

  d3.select(".x.axis .domain").remove();

  // Render grid to chart.
  var yAxisGrid = function() {
    return yAxis;
  };

  chartElement
    .append("g")
    .attr("class", "y grid")
    .call(
      yAxisGrid()
        .tickSize(-chartWidth, 0)
        .tickFormat("")
    );

  var bandwidth = xScale.bandwidth();
  var shift = -(bandwidth / 2) - (bandwidth * 0.1) / 2;
  var tickShift = function(d, i) {
    var existing = this.getAttribute("transform").match(
      /translate\(([^)]+)\)/
    )[1];
    existing = existing.split(",").map(Number);
    existing[0] += shift;
    existing[1] += 3;
    return makeTranslate(...existing);
  };

  // Shift tick marks
  chartElement.selectAll(".x.axis .tick").attr("transform", tickShift);

  var lastTick = chartElement
    .select(".x.axis")
    .append("g")
    .attr("class", "tick")
    .attr("transform", function() {
      var lastBin = xScale.domain()[xScale.domain().length - 1];

      var x = xScale(lastBin) + bandwidth + (bandwidth * 0.1) / 2;
      var y = 3;
      return makeTranslate(x, y);
    });

  lastTick
    .append("line")
    .attr("x1", 0)
    .attr("x2", 0)
    .attr("y1", 0)
    .attr("y2", 6);

  lastTick
    .append("text")
    .attr("text-anchor", "middle")
    .attr("x", 0)
    .attr("y", 9)
    .attr("dy", "0.71em")
    .attr("fill", "currentColor")
    .text(function() {
      var t = config.bins[config.bins.length - 1];
      if (t > 0) {
        return "+" + t + "%";
      } else {
        return t + "%";
      }
    });

  // Render bins to chart.
  var bins = chartElement
    .selectAll(".bin")
    .data(config.data)
    .enter()
    .append("g")
    .attr("class", (d, i) => "bin bin-" + i)
    .attr("transform", (d, i) => makeTranslate(xScale(COLOR_BINS[i]), 0));

  bins
    .selectAll("rect")
    .data(function(d, i) {
      // add the bin index to each row of data so we can assign the right color
      var formattedData = [];
      Object.keys(d).forEach(function(k) {
        var v = d[k];
        formattedData.push({ key: k, value: v, parentIndex: i });
      });
      return formattedData;
    })
    .enter()
    .append("rect")
    .attr("width", xScale.bandwidth())
    .attr("x", 0)
    .attr("y", (d, i) => chartHeight - (blockHeight + blockGap) * (i + 1))
    .attr("height", blockHeight)
    .attr("fill", d => config.colors[d.parentIndex])
    .attr("class", d => classify(d.value));

  // Render bin values.
  bins
    .append("g")
    .attr("class", "value")
    .selectAll("text")
    .data(function(d) {
      return Object.keys(d).map(key => ({ key, value: d[key] }));
    })
    .enter()
    .append("text")
    .attr("text-anchor", "middle")
    .attr("x", xScale.bandwidth() / 2)
    .attr("y", (d, i) => chartHeight - (blockHeight + blockGap) * (i + 1))
    .attr("dy", blockHeight / 2 + 4)
    .text(d => d.value);

  // Render annotations
  var annotations = chartElement.append("g").attr("class", "annotations");

  annotations
    .append("text")
    .attr("class", "label-top")
    .attr("x", xScale(0))
    .attr("dx", -15)
    .attr("text-anchor", "end")
    .attr("y", -10)
    .html(LABELS.annotation_left);

  annotations
    .append("text")
    .attr("class", "label-top")
    .attr("x", xScale(0))
    .attr("dx", 5)
    .attr("text-anchor", "begin")
    .attr("y", -10)
    .html(LABELS.annotation_right);

  annotations
    .append("line")
    .attr("class", "axis-0")
    .attr("x1", xScale(0) - (xScale.bandwidth() * 0.1) / 2)
    .attr("y1", -margins.top)
    .attr("x2", xScale(0) - (xScale.bandwidth() * 0.1) / 2)
    .attr("y2", chartHeight);
};

// Initially load the graphic
// (NB: Use window.load to ensure all images have loaded)
window.onload = onWindowLoaded;
