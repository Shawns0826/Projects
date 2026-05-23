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
    return "code";
  }

  function wrapBlock(block) {
    if (block.closest("details.code-collapse")) return false;

    var details = document.createElement("details");
    details.className = "code-collapse";

    var summary = document.createElement("summary");
    summary.className = "code-collapse__summary";
    summary.textContent = "Show " + labelFor(block) + " code";

    block.parentNode.insertBefore(details, block);
    details.appendChild(summary);
    details.appendChild(block);
    return true;
  }

  function wrapBlocks() {
    var prose = document.querySelector(".prose");
    if (!prose) return;

    var seen = new WeakSet();

    prose.querySelectorAll(".highlighter-rouge").forEach(function (block) {
      if (block.tagName === "CODE") return;
      if (!block.querySelector(".highlight")) return;
      if (seen.has(block)) return;
      seen.add(block);
      wrapBlock(block);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", wrapBlocks);
  } else {
    wrapBlocks();
  }
})();
