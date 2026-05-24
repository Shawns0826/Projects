(function () {
  var dialog = null;
  var imgEl = null;
  var captionEl = null;

  function ensureLightbox() {
    if (dialog) return dialog;

    dialog = document.createElement("dialog");
    dialog.className = "figure-lightbox";
    dialog.setAttribute("aria-labelledby", "figure-lightbox-caption");

    var inner = document.createElement("div");
    inner.className = "figure-lightbox__inner";

    var close = document.createElement("button");
    close.type = "button";
    close.className = "figure-lightbox__close";
    close.setAttribute("aria-label", "Close expanded image");
    close.textContent = "\u00d7";

    imgEl = document.createElement("img");
    imgEl.className = "figure-lightbox__img";

    captionEl = document.createElement("p");
    captionEl.id = "figure-lightbox-caption";
    captionEl.className = "figure-lightbox__caption";

    inner.appendChild(close);
    inner.appendChild(imgEl);
    inner.appendChild(captionEl);
    dialog.appendChild(inner);
    document.body.appendChild(dialog);

    close.addEventListener("click", closeLightbox);
    dialog.addEventListener("click", function (event) {
      if (event.target === dialog) closeLightbox();
    });
    dialog.addEventListener("cancel", function (event) {
      event.preventDefault();
      closeLightbox();
    });
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && dialog.open) closeLightbox();
    });

    return dialog;
  }

  function closeLightbox() {
    if (dialog && dialog.open) dialog.close();
  }

  function openLightbox(src, alt) {
    ensureLightbox();
    imgEl.src = src;
    imgEl.alt = alt || "";
    if (alt) {
      captionEl.textContent = alt;
      captionEl.hidden = false;
    } else {
      captionEl.textContent = "";
      captionEl.hidden = true;
    }
    dialog.showModal();
  }

  function bindTriggers() {
    document.querySelectorAll(".figure-expand").forEach(function (link) {
      if (link.dataset.lightboxBound) return;
      link.dataset.lightboxBound = "1";
      link.addEventListener("click", function (event) {
        event.preventDefault();
        var thumb = link.querySelector("img");
        openLightbox(link.href, thumb ? thumb.alt : "");
      });
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bindTriggers);
  } else {
    bindTriggers();
  }
})();
