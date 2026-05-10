(function () {
  function labelFor(block) {
    var langClass = Array.from(block.classList).find(function (c) {
      return c.indexOf("language-") === 0;
    });
    if (langClass) return langClass.slice("language-".length);
    var code = block.querySelector("code[class*='language-']");
    if (code && code.className) {
      var m = code.className.match(/language-([^\s]+)/);
      if (m) return m[1];
    }
    return "Code";
  }

  function rootForHighlight(hl) {
    var p = hl.parentElement;
    if (p && p.classList.contains("highlighter-rouge")) return p;
    return hl;
  }

  function wrapBlocks() {
    var prose = document.querySelector(".prose");
    if (!prose) return;

    var seen = new WeakSet();
    prose.querySelectorAll(".highlight").forEach(function (hl) {
      var block = rootForHighlight(hl);
      if (seen.has(block)) return;
      seen.add(block);
      if (block.closest("details.code-collapse")) return;

      var details = document.createElement("details");
      details.className = "code-collapse";
      details.open = true;

      var summary = document.createElement("summary");
      summary.className = "code-collapse__summary";
      summary.textContent = labelFor(block);

      block.parentNode.insertBefore(details, block);
      details.appendChild(summary);
      details.appendChild(block);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", wrapBlocks);
  } else {
    wrapBlocks();
  }
})();
