
/* ─────────────────────────────────────────────
   Auto-Resize Bridge
   Watches every possible source of layout change
   and reports the true content height to the
   parent frame via postMessage.
───────────────────────────────────────────── */
(function () {
    var lastHeight = 0;
    var rafId = null;

    /* 1. Accurate height — use getBoundingClientRect() on the body,
          which returns the actual rendered content height regardless
          of how tall the iframe (and html element) currently is.
          We intentionally avoid html.scrollHeight / html.clientHeight
          because the parent's iframe.style.height causes the html element
          to stretch, making those values mirror the old iframe height
          and preventing the iframe from ever shrinking. */
    function getHeight() {
        var body = document.body;
        var rect = body.getBoundingClientRect();
        var style = window.getComputedStyle(body);
        var mTop = parseFloat(style.marginTop) || 0;
        var mBottom = parseFloat(style.marginBottom) || 0;
        return Math.ceil(rect.height + mTop + mBottom);
    }

    /* 2. Send only when height actually changed
          (avoids flooding the parent with identical messages). */
    function sendHeight() {
        var h = getHeight();
        if (h !== lastHeight) {
            lastHeight = h;
            window.parent.postMessage({ type: 'resize', height: h }, '*');
        }
    }

    /* 3. Schedule via rAF so measurement happens after
          the browser has finished painting the new layout. */
    function scheduleUpdate() {
        if (rafId) cancelAnimationFrame(rafId);
        rafId = requestAnimationFrame(function () {
            rafId = null;
            sendHeight();
        });
    }

    /* 4. MutationObserver — catches any DOM change:
          added/removed nodes, text edits, attribute
          changes (class swaps, style changes, etc.). */
    var mutObs = new MutationObserver(scheduleUpdate);
    mutObs.observe(document.body, {
        childList: true,   // nodes added / removed
        subtree: true,   // watch entire tree
        attributes: true,   // class / style attribute changes
        characterData: true  // text node edits
    });

    /* 5. ResizeObserver — catches layout resizes that don't
          involve DOM mutations, e.g. a container changing
          width and causing content to reflow to more lines. */
    if (typeof ResizeObserver !== 'undefined') {
        var resObs = new ResizeObserver(scheduleUpdate);
        resObs.observe(document.body);
    }

    /* 6. Window resize — viewport width change can alter
          the height of responsive content inside the iframe. */
    window.addEventListener('resize', scheduleUpdate);

    /* 7. Images — an <img> that loads after the page paints
          will push content down; catch it explicitly. */
    function watchImages() {
        document.querySelectorAll('img').forEach(function (img) {
            if (!img.complete) {
                img.addEventListener('load', scheduleUpdate);
                img.addEventListener('error', scheduleUpdate);
            }
        });
    }

    /* Re-scan for new images whenever DOM changes. */
    var imgObs = new MutationObserver(function (mutations) {
        mutations.forEach(function (m) {
            m.addedNodes.forEach(function (node) {
                if (node.nodeType === 1) {            // Element node
                    if (node.tagName === 'IMG') {
                        node.addEventListener('load', scheduleUpdate);
                        node.addEventListener('error', scheduleUpdate);
                    }
                    node.querySelectorAll && node.querySelectorAll('img').forEach(function (img) {
                        img.addEventListener('load', scheduleUpdate);
                        img.addEventListener('error', scheduleUpdate);
                    });
                }
            });
        });
    });
    imgObs.observe(document.body, { childList: true, subtree: true });

    /* 8. CSS transitions/animations — fire update when they end
          so the post-animation height is reported correctly. */
    document.addEventListener('transitionend', scheduleUpdate);
    document.addEventListener('animationend', scheduleUpdate);

    /* 9. Fonts — web fonts load asynchronously and cause reflow. */
    if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(scheduleUpdate);
    }

    /* 10. Initial measurement: once DOM is ready and again
           after all resources (images, fonts) have loaded. */
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () {
            watchImages();
            scheduleUpdate();
        });
    } else {
        watchImages();
        scheduleUpdate();
    }
    window.addEventListener('load', scheduleUpdate);

})();
/* ─── End Auto-Resize Bridge ─── */
