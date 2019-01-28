var url = "https://ajax.googleapis.com/ajax/libs/webfont/1.5.18/webfont.js";
var script = document.createElement("script");
script.src = url;
document.head.appendChild(script);
script.onload = function() {
  WebFont.load({
    google: {
        families: ['Source Sans Pro:400,700,900']
    },
      timeout: 10000
  });
};