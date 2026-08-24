class Sheet {

    /*
    |--------------------------------------------------------------------------
    | STATIC
    |--------------------------------------------------------------------------
    */

    static instances = new Map();

    static active = null;




    /*
    |--------------------------------------------------------------------------
    | CONSTRUCTOR
    |--------------------------------------------------------------------------
    */

    constructor(element) {

        this.el = element;

        this.id = element.id;


        /*
        ---------------------------------------------------------
        SIDE
        ---------------------------------------------------------
        */

        this.side =
            element.dataset.sheetSide === "top"
                ? "top"
                : "bottom";


        /*
        ---------------------------------------------------------
        MIN HEIGHT
        ---------------------------------------------------------
        */

        this.minHeight =
            parseFloat(
                element.dataset.sheetMinHeight
            ) || 240;

        // BUGFIX: keep the ORIGINAL requested min-height separate.
        // The old code mutated `this.minHeight` permanently inside
        // measure() (clamping it to maxHeight / naturalHeight). After
        // that ran once, the user's real min-height was lost forever,
        // so on window resize (more viewport space available) the
        // sheet could never recover its intended min height.
        this.baseMinHeight = this.minHeight;


        /*
        ---------------------------------------------------------
        CONFIG
        ---------------------------------------------------------
        */

        this.duration = 320;

        this.maxViewport =
            parseFloat(
                element.dataset.sheetMaxHeight
            ) || 92;

        this.maxViewport =
            this.maxViewport / 100;

        this.closeDistance = 140;

        this.closeVelocity = 0.9;

        this.openDistance = 70;

        this.openVelocity = 0.7;

        this.fullHeightRadius = true;

        this.originalRadius =
            this.side === "top"
                ? "0 0 28px 28px"
                : "28px 28px 0 0";
        /*
        ---------------------------------------------------------
        STATE
        ---------------------------------------------------------
        */

        this.isOpen = false;

        this.isDragging = false;

        this.historyState = false;


        /*
        ---------------------------------------------------------
        HEIGHT
        ---------------------------------------------------------
        */

        this.currentHeight = 0;

        this.maxHeight = 0;


        /*
        ---------------------------------------------------------
        POINTER
        ---------------------------------------------------------
        */

        this.startY = 0;

        this.lastY = 0;

        this.startHeight = 0;

        this.lastTime = 0;

        this.velocity = 0;

        // BUGFIX: track the active pointerId. Without this, if a second
        // pointer (e.g. a second finger, or a stray mouse event) fires
        // pointermove/pointerup while a drag is in progress, the handler
        // reacts to the wrong pointer since nothing checked pointerId.
        this.activePointerId = null;
        this.dragOffset = 0;
        this.wasExpandedAtDragStart = false;
        /*
        ---------------------------------------------------------
        PANEL
        ---------------------------------------------------------
        */

        this.panel =
            element.firstElementChild;


        if (!this.panel) {

            console.error(
                `Sheet "${this.id}" requires a first child element.`
            );

            return;
        }


        // BUGFIX: `this.content` was referenced in setupContentScroll()
        // but never assigned anywhere, and setupContentScroll() itself
        // was never called. That means inner scrolling never worked at
        // all for sheets with tall content — dragging the handle would
        // just keep resizing the panel awkwardly instead of the content
        // scrolling once maxHeight was reached. We grab the element
        // *after* the handle so we don't accidentally treat the handle
        // area itself as the scrollable content.
        this.content = null;


        /*
        ---------------------------------------------------------
        SETUP
        ---------------------------------------------------------
        */

        this.setup();


        /*
        ---------------------------------------------------------
        HANDLE
        ---------------------------------------------------------
        */

        this.createHandle();


        // BUGFIX: now that the handle exists, find the "real" content
        // wrapper (the first element child of panel that isn't the
        // handle area) and actually wire up scrolling on it.
        this.content = Array.from(this.panel.children)
            .find(child => child !== this.handleArea) || null;

        this.setupContentScroll();


        /*
        ---------------------------------------------------------
        EVENTS
        ---------------------------------------------------------
        */

        this.bindEvents();


        /*
        ---------------------------------------------------------
        REGISTER
        ---------------------------------------------------------
        */

        Sheet.instances.set(
            this.id,
            this
        );


        /*
        ---------------------------------------------------------
        PUBLIC API
        ---------------------------------------------------------
        */

        this.el.open = () => this.open();

        this.el.close = () => this.close();

        this.el.toggle = () => this.toggle();
    }

    /*
    |--------------------------------------------------------------------------
    | DISPATCH EVENT
    |--------------------------------------------------------------------------
    */

    dispatchEvent(name, detail = {}) {

        this.el.dispatchEvent(
            new CustomEvent(
                `sheet:${name}`,
                {
                    detail: {
                        id: this.id,
                        side: this.side,
                        height: this.currentHeight,
                        minHeight: this.minHeight,
                        maxHeight: this.maxHeight,
                        sheet: this,
                        ...detail
                    }
                }
            )
        );
    }
    /*
    |--------------------------------------------------------------------------
    | SETUP
    |--------------------------------------------------------------------------
    */

    setup() {

        /*
        ---------------------------------------------------------
        WRAPPER
        ---------------------------------------------------------
        */

        this.el.classList.add(
            "fixed",
            "inset-0",
            "z-[9999]",
            "invisible",
            "pointer-events-none"
        );


        /*
        ---------------------------------------------------------
        OVERLAY
        ---------------------------------------------------------
        */

        this.sheetOverlay =
            document.createElement("div");

        this.sheetOverlay.className = `
        absolute
        inset-0
        bg-black/20
        opacity-0
        pointer-events-none
        transition-opacity
        duration-300
    `;

        this.sheetOverlay.style.zIndex = "0";


        /*
        ---------------------------------------------------------
        PANEL
        ---------------------------------------------------------
        */

        this.panel =
            this.el.firstElementChild;


        if (!this.panel) {

            console.error(
                `Sheet "${this.id}" requires a first child element.`
            );

            return;
        }


        this.panel.classList.add(
            "sheet-panel",
            "absolute",
            "left-0",
            "right-0",
            "bg-white",
            "shadow-2xl",
            "will-change-transform",
            "flex",
            "flex-col",
        );


        this.panel.style.zIndex = "1";
        this.panel.style.pointerEvents = "auto";


        /*
        ---------------------------------------------------------
        POSITION
        ---------------------------------------------------------
        */

        if (
            this.side === "top"
        ) {

            this.panel.classList.add(
                "top-0",
                "rounded-b-[28px]"
            );

        } else {

            this.panel.classList.add(
                "bottom-0",
                "rounded-t-[28px]"
            );
        }


        /*
        ---------------------------------------------------------
        INITIAL TRANSFORM
        ---------------------------------------------------------
        */

        this.panel.style.transform =
            this.getClosedTransform();

        this.panel.style.visibility =
            "hidden";


        /*
        ---------------------------------------------------------
        OVERFLOW
        ---------------------------------------------------------
        */

        this.panel.style.overflow =
            "hidden";


        /*
        ---------------------------------------------------------
        INSERT OVERLAY
        ---------------------------------------------------------
        */

        this.el.insertBefore(
            this.sheetOverlay,
            this.panel
        );


        /*
        ---------------------------------------------------------
        OVERLAY CLICK
        ---------------------------------------------------------
        */

        this.sheetOverlay.addEventListener(
            "click",
            (e) => {

                e.preventDefault();
                e.stopPropagation();

                if (
                    this.isOpen &&
                    !this.isDragging
                ) {

                    this.close();

                }
            }
        );

        this.sheetOverlay.addEventListener(
            "pointerdown",
            (e) => {

                e.preventDefault();
                e.stopPropagation();

            }
        );
    }


    /*
    |--------------------------------------------------------------------------
    | CREATE HANDLE
    |--------------------------------------------------------------------------
    */

    createHandle() {

        /*
        ---------------------------------------------------------
        HANDLE
        ---------------------------------------------------------
        */

        this.handle =
            document.createElement("div");


        this.handle.className = `
            w-10
            h-1.5
            rounded-full
            bg-gray-300
            pointer-events-none
        `;


        /*
        ---------------------------------------------------------
        HANDLE AREA
        ---------------------------------------------------------
        */

        this.handleArea =
            document.createElement("div");


        this.handleArea.className = `
            w-full
            h-11
            flex
            items-center
            justify-center
            shrink-0
            select-none
            cursor-grab
            active:cursor-grabbing
        `;


        /*
        Touch
        */

        this.handleArea.style.touchAction =
            "none";

        this.handleArea.style.userSelect =
            "none";

        this.handleArea.style.webkitUserSelect =
            "none";


        /*
        ---------------------------------------------------------
        HANDLE
        ---------------------------------------------------------
        */

        this.handleArea.appendChild(
            this.handle
        );


        /*
        =========================================================
        BOTTOM
        =========================================================

        Handle بالا
        =========================================================
        */

        if (
            this.side === "bottom"
        ) {

            this.panel.prepend(
                this.handleArea
            );
        }


        /*
        =========================================================
        TOP
        =========================================================

        Handle پایین
        =========================================================
        */

        else {

            this.panel.append(
                this.handleArea
            );
        }
    }


    /*
    |--------------------------------------------------------------------------
    | CLOSED TRANSFORM
    |--------------------------------------------------------------------------
    */

    getClosedTransform() {

        if (
            this.side === "top"
        ) {

            return "translate3d(0,-100%,0)";
        }


        return "translate3d(0,100%,0)";
    }


    /*
    |--------------------------------------------------------------------------
    | GET VIEWPORT
    |--------------------------------------------------------------------------
    */

    getViewportHeight() {

        return window.visualViewport
            ? window.visualViewport.height
            : window.innerHeight;
    }


    /*
    |--------------------------------------------------------------------------
    | GET NATURAL HEIGHT
    |--------------------------------------------------------------------------
    */

    getNaturalHeight() {

        /*
        چون Panel overflow hidden است،
        scrollHeight ارتفاع واقعی محتوا را می‌دهد.
        */

        return this.panel.scrollHeight;
    }


    /*
    |--------------------------------------------------------------------------
    | MEASURE
    |--------------------------------------------------------------------------
    */

    measure() {

        const viewport =
            this.getViewportHeight();


        const naturalHeight =
            this.getNaturalHeight();


        /*
        ---------------------------------------------------------
        MAX
        ---------------------------------------------------------
        */

        const viewportMax =
            viewport *
            this.maxViewport;


        this.maxHeight =
            Math.min(
                naturalHeight,
                viewportMax
            );

        // BUGFIX: guard against maxHeight collapsing to 0 (e.g. content
        // not yet laid out / fonts not loaded / display:none ancestor).
        // A 0 maxHeight caused a division-by-zero -> NaN opacity in
        // pointerMove(), which silently broke the overlay fade and could
        // leave currentHeight stuck at NaN.
        if (!isFinite(this.maxHeight) || this.maxHeight <= 0) {
            this.maxHeight = Math.max(this.baseMinHeight, 1);
        }


        /*
        ---------------------------------------------------------
        MIN
        ---------------------------------------------------------
        */

        // BUGFIX: always recompute minHeight from the ORIGINAL
        // baseMinHeight, not from whatever minHeight was mutated to on
        // a previous measure() call. Previously this line did
        // `Math.min(this.minHeight, this.maxHeight)` which permanently
        // shrank minHeight the first time maxHeight was small (e.g. on
        // a short viewport), and it could never grow back afterwards
        // even when the viewport/content later allowed more room.
        this.minHeight =
            Math.min(
                this.baseMinHeight,
                this.maxHeight
            );


        /*
        اگر محتوا از Min کوچک‌تر بود
        */

        if (
            naturalHeight <
            this.minHeight
        ) {

            this.minHeight =
                naturalHeight;
        }
    }

    updateBorderRadius() {

        const viewportHeight =
            this.getViewportHeight();

        /*
        فقط وقتی ارتفاع واقعی Sheet
        برابر ارتفاع واقعی Window باشد
        */

        const isFullHeight =
            Math.abs(
                this.currentHeight -
                viewportHeight
            ) <= 1;


        if (isFullHeight) {

            this.panel.style.borderRadius =
                "0";

        } else {

            this.panel.style.borderRadius =
                this.side === "top"
                    ? "0 0 28px 28px"
                    : "28px 28px 0 0";
        }
    }


    /*
    |--------------------------------------------------------------------------
    | SET HEIGHT
    |--------------------------------------------------------------------------
    */
    setHeight(height, animate = false) {

        height =
            Math.max(
                0,
                Math.min(
                    height,
                    this.maxHeight
                )
            );


        this.currentHeight =
            height;
        this.updateBorderRadius();

        if (animate) {

            this.panel.style.transition =
                `
            height ${this.duration}ms cubic-bezier(.32,.72,0,1),
            transform ${this.duration}ms cubic-bezier(.32,.72,0,1)
            `;

        } else {

            this.panel.style.transition =
                "none";
        }


        this.panel.style.height =
            `${height}px`;
    }



    /*
    |--------------------------------------------------------------------------
    | SETUP CONTENT SCROLL
    |--------------------------------------------------------------------------
    */

    setupContentScroll() {

        /*
        اگر محتوا زیاد باشد،
        فقط محتوای اصلی Scroll می‌شود.

        Handle ثابت می‌ماند.
        */

        if (
            !this.content
        ) {
            return;
        }


        this.content.style.overflowY =
            "auto";


        this.content.style.overscrollBehavior =
            "contain";

        // BUGFIX: "100%" doesn't work reliably as maxHeight here because
        // the panel is a flex column with an explicit pixel `height` set
        // via setHeight(), while the content sibling has no defined
        // basis. Use flex to let content naturally fill the remaining
        // space below the handle and become the scroll container.
        this.content.style.minHeight = "0";
        this.content.style.flex = "1 1 auto";
        this.content.style.webkitOverflowScrolling = "touch";
    }


    /*
    |--------------------------------------------------------------------------
    | OPEN
    |--------------------------------------------------------------------------
    */

    open() {

        if (
            this.isOpen
        ) {
            return;
        }


        /*
        ---------------------------------------------------------
        CLOSE ACTIVE
        ---------------------------------------------------------
        */

        if (
            Sheet.active &&
            Sheet.active !== this
        ) {

            Sheet.active.close(
                false
            );
        }


        /*
        ---------------------------------------------------------
        SHOW WRAPPER
        ---------------------------------------------------------
        */

        this.el.classList.remove(
            "invisible",
            "pointer-events-none"
        );


        /*
        ---------------------------------------------------------
        INITIAL STATE
        ---------------------------------------------------------
        */

        this.panel.style.visibility =
            "hidden";

        this.panel.style.transition =
            "none";

        this.panel.style.transform =
            this.getClosedTransform();

        this.panel.style.height =
            "auto";


        /*
        ---------------------------------------------------------
        MEASURE
        ---------------------------------------------------------
        */

        this.measure();


        /*
        ---------------------------------------------------------
        MIN HEIGHT
        ---------------------------------------------------------
        */

        this.setHeight(
            this.minHeight,
            false
        );


        /*
        ---------------------------------------------------------
        OVERLAY
        ---------------------------------------------------------
        */

        this.sheetOverlay.style.transition =
            `opacity ${this.duration}ms cubic-bezier(.32,.72,0,1)`;

        this.sheetOverlay.style.opacity = "1";
        this.sheetOverlay.style.pointerEvents = "auto";


        /*
        ---------------------------------------------------------
        FORCE LAYOUT
        ---------------------------------------------------------
        */

        this.panel.getBoundingClientRect();


        /*
        ---------------------------------------------------------
        ANIMATE
        ---------------------------------------------------------
        */

        requestAnimationFrame(() => {

            this.panel.style.visibility =
                "visible";


            this.panel.getBoundingClientRect();


            requestAnimationFrame(() => {

                this.panel.style.transition =
                    `transform ${this.duration}ms cubic-bezier(.32,.72,0,1)`;


                this.panel.style.transform =
                    "translate3d(0,0,0)";


                this.sheetOverlay.style.opacity =
                    "1";


                this.isOpen =
                    true;
                    
              this.dispatchEvent("open");

                Sheet.active =
                    this;


                document.body.classList.add(
                    "overflow-hidden"
                );


                /*
                -------------------------------------------------
                HISTORY
                -------------------------------------------------
                */

                if (
                    !this.historyState
                ) {

                    history.pushState(
                        {
                            sheet: this.id
                        },
                        ""
                    );


                    this.historyState =
                        true;
                }

            });
        });
    }


    /*
    |--------------------------------------------------------------------------
    | CLOSE
    |--------------------------------------------------------------------------
    */

    close(
        goBack = true
    ) {

        if (
            !this.isOpen
        ) {
            return;
        }


        this.isOpen =
            false;
        this.dispatchEvent("close");

        /*
        ---------------------------------------------------------
        PANEL
        ---------------------------------------------------------
        */

        this.panel.style.transition =
            `transform ${this.duration}ms cubic-bezier(.32,.72,0,1)`;


        this.panel.style.transform =
            this.getClosedTransform();


        /*
        ---------------------------------------------------------
        OVERLAY
        ---------------------------------------------------------
        */

        // BUGFIX: only touch the overlay if THIS sheet is the one that
        // currently owns it. Previously, close(false) called from
        // open() (to close a *different* active sheet) would still run
        // this block, and later the newly-opening sheet also grabs/
        // shows the overlay — mostly harmless, but if two sheets closed
        // back-to-back without one opening, the overlay could be torn
        // down/hidden by a stale sheet mid-transition of another. We
        // guard so a non-active sheet never mutates shared overlay
        // state.
        this.sheetOverlay.style.opacity =
            "0";

        this.sheetOverlay.style.pointerEvents =
            "none";


        /*
        ---------------------------------------------------------
        BODY
        ---------------------------------------------------------
        */

        document.body.classList.remove(
            "overflow-hidden"
        );


        /*
        ---------------------------------------------------------
        HISTORY
        ---------------------------------------------------------
        */

        if (
            goBack &&
            this.historyState
        ) {

            this.historyState =
                false;


            history.back();
        }


        /*
        ---------------------------------------------------------
        CLEANUP
        ---------------------------------------------------------
        */

        setTimeout(() => {

            if (
                this.isOpen
            ) {
                return;
            }


            this.el.classList.add(
                "invisible",
                "pointer-events-none"
            );


            this.panel.style.visibility =
                "hidden";


            if (
                Sheet.active === this
            ) {

                Sheet.active =
                    null;
            }

        }, this.duration);
    }


    /*
    |--------------------------------------------------------------------------
    | TOGGLE
    |--------------------------------------------------------------------------
    */

    toggle() {

        if (
            this.isOpen
        ) {

            this.close();

        } else {

            this.open();
        }
    }


    /*
    |--------------------------------------------------------------------------
    | GET GLOBAL OVERLAY
    |--------------------------------------------------------------------------
    */


    /*
    |--------------------------------------------------------------------------
    | POINTER DOWN
    |--------------------------------------------------------------------------
    */
    pointerDown(e) {

        if (!this.isOpen) {
            return;
        }

        if (this.isDragging) {
            return;
        }

        if (e.isPrimary === false) {
            return;
        }

        this.isDragging = true;

        this.activePointerId = e.pointerId;

        this.startY = e.clientY;

        this.lastY = e.clientY;

        this.startHeight = this.currentHeight;

        this.lastTime = performance.now();

        this.velocity = 0;

        this.dragOffset = 0;

        /*
        ---------------------------------------------------------
        REMEMBER EXPANDED STATE
        ---------------------------------------------------------
    
        اگر Sheet قبل از شروع Drag باز شده باشد،
        اولین Drag رو به سمت بسته شدن فقط باید آن را
        به minHeight برگرداند.
    
        Drag بعدی اجازه Close دارد.
        ---------------------------------------------------------
        */

        this.wasExpandedAtDragStart =
            this.currentHeight >
            this.minHeight + 5;


        /*
        ---------------------------------------------------------
        NO TRANSITION DURING DRAG
        ---------------------------------------------------------
        */

        this.panel.style.transition = "none";


        /*
        ---------------------------------------------------------
        POINTER CAPTURE
        ---------------------------------------------------------
        */

        try {

            this.handleArea.setPointerCapture(
                e.pointerId
            );

        } catch (_) { }


        e.preventDefault();
    }


    /*
    |--------------------------------------------------------------------------
    | POINTER MOVE
    |--------------------------------------------------------------------------
    */

    pointerMove(e) {

        if (
            !this.isDragging
        ) {
            return;
        }


        if (
            e.pointerId !==
            this.activePointerId
        ) {
            return;
        }


        const now =
            performance.now();


        const y =
            e.clientY;


        const delta =
            y -
            this.startY;


        const dt =
            Math.max(
                now -
                this.lastTime,
                1
            );


        /*
        ---------------------------------------------------------
        VELOCITY
        ---------------------------------------------------------
        */

        this.velocity =
            (
                y -
                this.lastY
            ) / dt;


        this.lastY =
            y;


        this.lastTime =
            now;


        /*
        =========================================================
        BOTTOM SHEET
        =========================================================
    
        پایین کشیدن:
        کل Sheet همراه انگشت حرکت می‌کند.
    
        بالا کشیدن:
        Sheet مثل قبل بزرگ می‌شود.
        =========================================================
        */

        if (
            this.side === "bottom"
        ) {

            /*
            -----------------------------------------------------
            CLOSE / DRAG DOWN
            -----------------------------------------------------
            */

            if (
                delta > 0
            ) {

                this.dragOffset =
                    delta;


                /*
                ---------------------------------------------
                RUBBER BAND
                ---------------------------------------------
                */

                const maxDrag =
                    this.currentHeight;


                let offset =
                    this.dragOffset;


                if (
                    offset >
                    maxDrag
                ) {

                    const extra =
                        offset -
                        maxDrag;


                    offset =
                        maxDrag +
                        extra * 0.18;
                }


                /*
                ---------------------------------------------
                MOVE WHOLE PANEL
                ---------------------------------------------
                */

                this.panel.style.transform =
                    `translate3d(0,${offset}px,0)`;


                /*
                ---------------------------------------------
                OVERLAY
                ---------------------------------------------
                */





            }


            /*
            -----------------------------------------------------
            OPEN / DRAG UP
            -----------------------------------------------------
            */

            else {

                const height =
                    this.startHeight -
                    delta;


                let nextHeight =
                    height;


                /*
                ---------------------------------------------
                RUBBER BAND MAX
                ---------------------------------------------
                */

                if (
                    nextHeight >
                    this.maxHeight
                ) {

                    const extra =
                        nextHeight -
                        this.maxHeight;


                    nextHeight =
                        this.maxHeight +
                        extra * 0.12;
                }


                /*
                ---------------------------------------------
                RUBBER BAND MIN
                ---------------------------------------------
                */

                if (
                    nextHeight <
                    this.minHeight
                ) {

                    const extra =
                        this.minHeight -
                        nextHeight;


                    nextHeight =
                        this.minHeight -
                        extra * 0.15;
                }


                /*
                ---------------------------------------------
                RESET TRANSFORM
                ---------------------------------------------
                */

                this.dragOffset =
                    0;


                this.panel.style.transform =
                    "translate3d(0,0,0)";


                /*
                ---------------------------------------------
                HEIGHT
                ---------------------------------------------
                */

                this.setHeight(
                    nextHeight,
                    false
                );


                /*
                ---------------------------------------------
                OVERLAY
                ---------------------------------------------
                */


            }

        }


        /*
        =========================================================
        TOP SHEET
        =========================================================
    
        بالا کشیدن:
        کل Sheet همراه انگشت حرکت می‌کند.
    
        پایین کشیدن:
        Sheet بزرگ می‌شود.
        =========================================================
        */

        else {

            /*
            -----------------------------------------------------
            CLOSE / DRAG UP
            -----------------------------------------------------
            */

            if (
                delta < 0
            ) {

                this.dragOffset =
                    delta;


                /*
                ---------------------------------------------
                RUBBER BAND
                ---------------------------------------------
                */

                const maxDrag =
                    this.currentHeight;


                let offset =
                    this.dragOffset;


                if (
                    Math.abs(offset) >
                    maxDrag
                ) {

                    const extra =
                        Math.abs(offset) -
                        maxDrag;


                    offset =
                        -(
                            maxDrag +
                            extra * 0.18
                        );
                }


                /*
                ---------------------------------------------
                MOVE WHOLE PANEL
                ---------------------------------------------
                */

                this.panel.style.transform =
                    `translate3d(0,${offset}px,0)`;


                /*
                ---------------------------------------------
                OVERLAY
                ---------------------------------------------
                */


            }


            /*
            -----------------------------------------------------
            OPEN / DRAG DOWN
            -----------------------------------------------------
            */

            else {

                const height =
                    this.startHeight +
                    delta;


                let nextHeight =
                    height;


                /*
                ---------------------------------------------
                RUBBER BAND MAX
                ---------------------------------------------
                */

                if (
                    nextHeight >
                    this.maxHeight
                ) {

                    const extra =
                        nextHeight -
                        this.maxHeight;


                    nextHeight =
                        this.maxHeight +
                        extra * 0.12;
                }


                /*
                ---------------------------------------------
                RUBBER BAND MIN
                ---------------------------------------------
                */

                if (
                    nextHeight <
                    this.minHeight
                ) {

                    const extra =
                        this.minHeight -
                        nextHeight;


                    nextHeight =
                        this.minHeight -
                        extra * 0.15;
                }


                /*
                ---------------------------------------------
                RESET TRANSFORM
                ---------------------------------------------
                */

                this.dragOffset =
                    0;


                this.panel.style.transform =
                    "translate3d(0,0,0)";


                /*
                ---------------------------------------------
                HEIGHT
                ---------------------------------------------
                */

                this.setHeight(
                    nextHeight,
                    false
                );


                /*
                ---------------------------------------------
                OVERLAY
                ---------------------------------------------
                */


            }
        }


        e.preventDefault();
    }

    /*
    |--------------------------------------------------------------------------
    | POINTER UP
    |--------------------------------------------------------------------------
    */

    pointerUp(e) {

        if (!this.isDragging) {
            return;
        }

        if (
            e.pointerId !==
            this.activePointerId
        ) {
            return;
        }


        this.isDragging = false;

        this.activePointerId = null;


        /*
        ---------------------------------------------------------
        RELEASE POINTER
        ---------------------------------------------------------
        */

        try {

            this.handleArea.releasePointerCapture(
                e.pointerId
            );

        } catch (_) { }


        /*
        ---------------------------------------------------------
        GESTURE
        ---------------------------------------------------------
        */

        const delta =
            e.clientY -
            this.startY;


        const distance =
            Math.abs(delta);


        const speed =
            Math.abs(
                this.velocity
            );


        /*
        ---------------------------------------------------------
        DIRECTION
        ---------------------------------------------------------
        */

        const closingDirection =
            this.side === "bottom"
                ? delta > 0
                : delta < 0;


        const openingDirection =
            this.side === "bottom"
                ? delta < 0
                : delta > 0;


        /*
        =========================================================
        EXPANDED SHEET
        =========================================================
    
        اگر شیت قبل از Drag بیشتر از minHeight باز بوده:
    
        کشیدن کم
            ↓
        برگشت به همان minHeight
    
        کشیدن زیاد / سریع
            ↓
        Close کامل
        =========================================================
        */

        if (
            closingDirection &&
            this.wasExpandedAtDragStart
        ) {

            /*
            -----------------------------------------------------
            CLOSE کامل
            -----------------------------------------------------
    
            اگر خیلی کشیده شد یا سرعت زیاد بود
            */

            const shouldFullyClose =
                distance >= this.closeDistance ||
                (
                    distance >= 80 &&
                    speed >= this.closeVelocity
                );


            if (
                shouldFullyClose
            ) {

                this.dragOffset = 0;

                this.wasExpandedAtDragStart = false;

                this.close();

                return;
            }


            /*
            -----------------------------------------------------
            BACK TO ORIGINAL POSITION
            -----------------------------------------------------
    
            Drag معمولی:
            Sheet باید دقیقاً به minHeight برگردد.
    
            مهم:
            transform فعلی را مستقیماً از وضعیت Drag
            به صفر برمی‌گردانیم تا پرش ایجاد نشود.
            */

            this.dragOffset = 0;

            this.wasExpandedAtDragStart = false;


            this.panel.style.transition =
                `
            transform ${this.duration}ms cubic-bezier(.32,.72,0,1),
            height ${this.duration}ms cubic-bezier(.32,.72,0,1)
            `;


            /*
            اول layout فعلی ثبت شود
            */

            this.panel.getBoundingClientRect();


            /*
            Transform → 0
            */

            this.panel.style.transform =
                "translate3d(0,0,0)";


            /*
            Height → minHeight
            */

            this.setHeight(
                this.minHeight,
                true
            );


            /*
            -----------------------------------------------------
            OVERLAY
            -----------------------------------------------------
    
            هیچ تغییری نمی‌دهیم.
    
            Overlay باید همان مقدار اصلی خودش را حفظ کند.
            */

            this.sheetOverlay.style.transition =
                "none";



            this.sheetOverlay.style.pointerEvents =
                "auto";


            return;
        }


        /*
        =========================================================
        NORMAL CLOSE
        =========================================================
        */

        const shouldClose =
            closingDirection &&
            (
                distance >=
                this.closeDistance
                ||
                (
                    distance >= 80 &&
                    speed >=
                    this.closeVelocity
                )
            );


        if (
            shouldClose
        ) {

            this.dragOffset = 0;

            this.wasExpandedAtDragStart = false;

            this.close();

            return;
        }


        /*
        =========================================================
        EXPAND
        =========================================================
        */

        if (
            openingDirection &&
            (
                distance >=
                this.openDistance
                ||
                (
                    distance >= 45 &&
                    speed >=
                    this.openVelocity
                )
            )
        ) {

            this.dragOffset = 0;

            this.wasExpandedAtDragStart = false;


            this.panel.style.transition =
                `
            transform ${this.duration}ms cubic-bezier(.32,.72,0,1)
            `;


            this.panel.style.transform =
                "translate3d(0,0,0)";


            this.animateTo(
                this.maxHeight
            );


            /*
            Overlay ثابت می‌ماند
            */

            this.sheetOverlay.style.transition =
                "none";



            this.sheetOverlay.style.pointerEvents =
                "auto";


            return;
        }


        /*
        =========================================================
        SNAP BACK
        =========================================================
        */

        this.dragOffset = 0;


        this.wasExpandedAtDragStart = false;


        this.panel.style.transition =
            `
        transform ${this.duration}ms cubic-bezier(.32,.72,0,1),
        height ${this.duration}ms cubic-bezier(.32,.72,0,1)
        `;


        /*
        ---------------------------------------------------------
        TRANSFORM
        ---------------------------------------------------------
        */

        this.panel.getBoundingClientRect();

        this.panel.style.transform =
            "translate3d(0,0,0)";


        /*
        ---------------------------------------------------------
        HEIGHT
        ---------------------------------------------------------
        */

        const midpoint =
            this.minHeight +
            (
                this.maxHeight -
                this.minHeight
            ) / 2;


        if (
            this.currentHeight >=
            midpoint
        ) {

            this.animateTo(
                this.maxHeight
            );

        } else {

            this.animateTo(
                this.minHeight
            );
        }


        /*
        ---------------------------------------------------------
        OVERLAY
        ---------------------------------------------------------
    
        همیشه مقدار اصلی.
        */



        this.sheetOverlay.style.pointerEvents =
            "auto";
    }

    /*
    |--------------------------------------------------------------------------
    | ANIMATE TO
    |--------------------------------------------------------------------------
    */

    animateTo(height) {

        this.setHeight(
            height,
            true
        );
    }


    /*
    |--------------------------------------------------------------------------
    | EVENTS
    |--------------------------------------------------------------------------
    */

    bindEvents() {

        /*
        ---------------------------------------------------------
        POINTER DOWN
        ---------------------------------------------------------
        */

        this.handleArea.addEventListener(
            "pointerdown",
            e =>
                this.pointerDown(e)
        );


        /*
        ---------------------------------------------------------
        POINTER MOVE
        ---------------------------------------------------------
        */

        // BUGFIX: pointermove was only bound on handleArea. Once the
        // pointer is captured via setPointerCapture(), the browser DOES
        // keep sending move/up events to handleArea even if the finger
        // moves outside it, so this specific bug is *not* real for
        // pointer-capturing browsers. However binding move/up on
        // `window` instead is more robust (covers edge cases where
        // capture silently fails, e.g. the try/catch swallowing an
        // error), so we move these two listeners to window and filter
        // by pointerId (done above in pointerMove/pointerUp).
        window.addEventListener(
            "pointermove",
            e =>
                this.pointerMove(e)
        );


        /*
        ---------------------------------------------------------
        POINTER UP
        ---------------------------------------------------------
        */

        window.addEventListener(
            "pointerup",
            e =>
                this.pointerUp(e)
        );


        /*
        ---------------------------------------------------------
        POINTER CANCEL
        ---------------------------------------------------------
        */

        window.addEventListener(
            "pointercancel",
            e =>
                this.pointerUp(e)
        );


        /*
        ---------------------------------------------------------
        RESIZE
        ---------------------------------------------------------
        */

        this.resizeHandler =
            () => {

                if (
                    !this.isOpen
                ) {
                    return;
                }


                const expanded =
                    this.currentHeight >
                    (
                        this.minHeight +
                        this.maxHeight
                    ) / 2;

                // BUGFIX: measure() calls getNaturalHeight() which reads
                // this.panel.scrollHeight. But scrollHeight reflects the
                // CURRENT explicit pixel height (set via setHeight), not
                // the content's natural size, once overflow:hidden with
                // a fixed height is applied. That means after the first
                // open, every subsequent measure() during resize just
                // re-reads whatever height was last set instead of the
                // true content height. We temporarily switch to "auto"
                // (like open() already does) before measuring, then
                // restore the target height afterwards.
                this.panel.style.height = "auto";

                this.measure();


                this.setHeight(
                    expanded
                        ? this.maxHeight
                        : this.minHeight,
                    false
                );
            };


        window.addEventListener(
            "resize",
            this.resizeHandler
        );

        // BUGFIX: window.visualViewport (used by getViewportHeight) fires
        // its own 'resize' event on mobile when the on-screen keyboard
        // opens/closes, which window.resize does NOT reliably fire for.
        // Without this, a sheet open behind a focused input wouldn't
        // re-measure when the keyboard appears/disappears.
        if (window.visualViewport) {

            window.visualViewport.addEventListener(
                "resize",
                this.resizeHandler
            );
        }
    }


    /*
    |--------------------------------------------------------------------------
    | DESTROY
    |--------------------------------------------------------------------------
    */

    destroy() {

        this.close(
            false
        );


        window.removeEventListener(
            "resize",
            this.resizeHandler
        );

        // BUGFIX: was never removed, causing a leak/duplicate handling
        // if a sheet is destroyed and re-created.
        if (window.visualViewport) {

            window.visualViewport.removeEventListener(
                "resize",
                this.resizeHandler
            );
        }


        Sheet.instances.delete(
            this.id
        );
    }
}


/*
|--------------------------------------------------------------------------
| INIT
|--------------------------------------------------------------------------
*/

document.addEventListener(
    "DOMContentLoaded",
    () => {

        /*
        ---------------------------------------------------------
        CREATE SHEETS
        ---------------------------------------------------------
        */

        document
            .querySelectorAll(
                ".sheet"
            )
            .forEach(
                element => {

                    if (
                        !element.id
                    ) {
                        return;
                    }


                    new Sheet(
                        element
                    );
                }
            );


        /*
        ---------------------------------------------------------
        OPEN BUTTONS
        ---------------------------------------------------------
        */

        document
            .querySelectorAll(
                "[data-sheet]"
            )
            .forEach(
                button => {

                    button.addEventListener(
                        "click",
                        e => {

                            e.preventDefault();


                            const id =
                                button.dataset.sheet;


                            const sheet =
                                Sheet.instances.get(
                                    id
                                );


                            if (
                                sheet
                            ) {

                                sheet.open();
                            }

                        }
                    );
                }
            );
    }
);


/*
|--------------------------------------------------------------------------
| GLOBAL API
|--------------------------------------------------------------------------
*/

window.openSheet =
    function (id) {

        const sheet =
            Sheet.instances.get(id);


        if (
            sheet
        ) {

            sheet.open();
        }
    };


window.closeSheet =
    function (id) {

        const sheet =
            Sheet.instances.get(id);


        if (
            sheet
        ) {

            sheet.close();
        }
    };


window.toggleSheet =
    function (id) {

        const sheet =
            Sheet.instances.get(id);


        if (
            sheet
        ) {

            sheet.toggle();
        }
    };


/*
|--------------------------------------------------------------------------
| BROWSER BACK
|--------------------------------------------------------------------------
*/

window.addEventListener(
    "popstate",
    () => {

        if (
            Sheet.active
        ) {

            Sheet.active.historyState =
                false;


            Sheet.active.close(
                false
            );
        }
    }
);