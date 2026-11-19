      (() => {
        "use strict";

        const gbp = new Intl.NumberFormat("en-GB", {
          style: "currency",
          currency: "GBP",
        });

        const factorFormat = new Intl.NumberFormat("en-GB", {
          maximumFractionDigits: 4,
        });

        const DASH = "—";

        function parseAmount(raw) {
          const cleaned = String(raw).replace(/[£,\s]/g, "");

          if (cleaned === "") return { empty: true, value: 0 };
          if (!/^\d*\.?\d*$/.test(cleaned) || cleaned === ".") return { invalid: true };

          const value = Number(cleaned);
          if (!Number.isFinite(value) || value < 0) return { invalid: true };

          return { value, empty: false };
        }

        function parseRate(raw) {
          const cleaned = String(raw).trim().replace(",", ".");

          if (cleaned === "") return { empty: true };
          if (!/^\d*\.?\d*$/.test(cleaned) || cleaned === ".") return { invalid: true };

          const value = Number(cleaned);
          if (!Number.isFinite(value) || value < 0 || value > 100) return { invalid: true };

          return { value };
        }

        async function writeClipboard(text) {
          try {
            await navigator.clipboard.writeText(text);
            return true;
          } catch {
            // Fall through to the legacy copy path (also covers file:// pages).
          }

          const area = document.createElement("textarea");
          area.value = text;
          area.setAttribute("readonly", "");
          area.style.position = "fixed";
          area.style.opacity = "0";
          document.body.appendChild(area);
          area.select();

          let copied = false;
          try {
            copied = document.execCommand("copy");
          } catch {
            copied = false;
          }

          area.remove();
          return copied;
        }

        const form = document.getElementById("vat-form");
        const amountInput = document.getElementById("amount");
        const amountLabel = document.getElementById("amount-label");
        const amountTag = document.getElementById("amount-tag");
        const amountError = document.getElementById("amount-error");
        const modeHelp = document.getElementById("mode-help");
        const customWrap = document.getElementById("custom-wrap");
        const customRate = document.getElementById("custom-rate");
        const rateError = document.getElementById("rate-error");
        const status = document.getElementById("result-status");
        const formula = document.getElementById("formula");
        const resultsPanel = document.getElementById("results-panel");
        const footer = document.querySelector("footer");
        const barNet = document.getElementById("bar-net");
        const barVat = document.getElementById("bar-vat");
        const shareNet = document.getElementById("share-net");
        const shareVat = document.getElementById("share-vat");
        const mobileBar = document.getElementById("mobile-bar");
        const mobileLabel = document.getElementById("mobile-label");
        const mobileTotal = document.getElementById("mobile-total");
        const mobileCopy = document.getElementById("mobile-copy");
        const toast = document.getElementById("toast");
        const toastText = document.getElementById("toast-text");
        const copyIcon = document.getElementById("copy-icon");
        const copyCheck = document.getElementById("copy-check");
        const shareButton = document.getElementById("share");
        const shareText = document.getElementById("share-text");
        const keypad = document.getElementById("keypad");

        const els = {
          total: document.getElementById("total"),
          totalLabel: document.getElementById("total-label"),
          rateNote: document.getElementById("rate-note"),
          net: document.getElementById("net"),
          vat: document.getElementById("vat"),
          vatLabel: document.getElementById("vat-label"),
          gross: document.getElementById("gross"),
          copy: document.getElementById("copy"),
          copyText: document.getElementById("copy-text"),
        };

        const modeRadios = Array.from(document.querySelectorAll('input[name="mode"]'));
        const rateRadios = Array.from(document.querySelectorAll('input[name="rate"]'));

        let copyTimer;
        let toastTimer;
        let toastClearTimer;
        let announceTimer;
        let shareTimer;
        let keypadFresh = true;
        let hashReady = false;
        let suppressHash = false;

        const current = {
          netP: 0,
          vatP: 0,
          grossP: 0,
          rateLabel: "20%",
          rateName: "standard rate",
          mode: "add",
          valid: false,
        };

        function getRateInfo() {
          const selected = document.querySelector('input[name="rate"]:checked').value;

          if (selected !== "custom") {
            return {
              valid: true,
              rate: Number(selected),
              label: `${selected}%`,
              name:
                selected === "20"
                  ? "standard rate"
                  : selected === "5"
                    ? "reduced rate"
                    : "zero rate",
            };
          }

          const parsed = parseRate(customRate.value);
          if (parsed.invalid || parsed.empty) {
            return { valid: false, rate: 0, label: DASH, name: "custom rate" };
          }

          return { valid: true, rate: parsed.value, label: `${parsed.value}%`, name: "custom rate" };
        }

        function showToast(message) {
          toastText.textContent = message;
          toast.classList.remove("opacity-0");
          toast.classList.add("opacity-100");

          clearTimeout(toastTimer);
          clearTimeout(toastClearTimer);

          toastTimer = setTimeout(() => {
            toast.classList.remove("opacity-100");
            toast.classList.add("opacity-0");
          }, 2200);

          toastClearTimer = setTimeout(() => {
            if (toastText.textContent === message) toastText.textContent = "";
          }, 2600);
        }

        function currentStateParams() {
          if (!current.valid) return "";

          const parsed = parseAmount(amountInput.value);
          if (parsed.invalid || parsed.empty) return "";

          const selectedRate = document.querySelector('input[name="rate"]:checked').value;
          const params = new URLSearchParams();
          params.set("amount", String(parsed.value));
          params.set("mode", current.mode);
          params.set("rate", selectedRate);

          if (selectedRate === "custom") {
            params.set("cr", String(getRateInfo().rate));
          }

          return params.toString();
        }

        function writeStateHash() {
          if (!hashReady || suppressHash) return;

          const query = currentStateParams();
          if (!query) return;

          try {
            history.replaceState(null, "", `#${query}`);
          } catch {
            // Some browsers restrict history changes on file:// pages. The share button still
            // builds a complete URL from the current inputs.
          }
        }

        function stateUrl() {
          const query = currentStateParams();
          return query ? `${location.href.split("#")[0]}#${query}` : location.href.split("#")[0];
        }

        function applyStateFromHash() {
          const hash = location.hash.replace(/^#/, "");
          if (!hash || !/(^|&)amount=/.test(hash)) return false;

          const params = new URLSearchParams(hash);
          const amount = params.get("amount");
          if (amount === null) return false;

          const parsed = parseAmount(amount);
          if (parsed.invalid || parsed.empty) return false;

          amountInput.value = String(parsed.value);

          const mode = params.get("mode");
          if (mode === "add" || mode === "remove") {
            modeRadios.forEach((radio) => {
              radio.checked = radio.value === mode;
            });
          }

          const rate = params.get("rate");
          if (rate === "20" || rate === "5" || rate === "0" || rate === "custom") {
            rateRadios.forEach((radio) => {
              radio.checked = radio.value === rate;
            });

            if (rate === "custom") {
              customRate.value = params.get("cr") || "";
              customWrap.classList.remove("hidden");
            }
          }

          keypadFresh = true;
          suppressHash = true;
          update(false);
          suppressHash = false;
          return true;
        }

        function update(announce = true) {
          const mode = document.querySelector('input[name="mode"]:checked').value;
          const rateInfo = getRateInfo();
          const parsed = parseAmount(amountInput.value);
          const isCustom = document.querySelector('input[name="rate"]:checked').value === "custom";

          customWrap.classList.toggle("hidden", !isCustom);

          const amountInvalid = parsed.invalid === true;
          const amountEmpty = parsed.empty === true;
          const rateInvalid = !rateInfo.valid;
          const valid = !amountInvalid && !amountEmpty && !rateInvalid;

          amountError.textContent = amountInvalid
            ? "Enter a valid amount, e.g. 120 or 1,200.50"
            : "";
          amountError.classList.toggle("hidden", !amountInvalid);
          amountInput.classList.toggle("border-red-400", amountInvalid);
          amountInput.classList.toggle("focus:border-red-500", amountInvalid);

          const showRateError = isCustom && rateInvalid && customRate.value.trim() !== "";
          rateError.textContent = showRateError
            ? "Enter a custom rate between 0 and 100."
            : "";
          rateError.classList.toggle("hidden", !showRateError);
          customRate.classList.toggle("border-red-400", showRateError);

          const pence = valid ? Math.round(parsed.value * 100) : 0;

          let netP = 0;
          let vatP = 0;
          let grossP = 0;

          if (valid) {
            if (mode === "add") {
              netP = pence;
              vatP = Math.round((pence * rateInfo.rate) / 100);
              grossP = netP + vatP;
            } else {
              grossP = pence;
              netP = Math.round(pence / (1 + rateInfo.rate / 100));
              vatP = grossP - netP;
            }
          }

          const totalP = mode === "add" ? grossP : netP;
          const money = (value) => (valid ? gbp.format(value / 100) : DASH);

          els.net.textContent = money(netP);
          els.vat.textContent = money(vatP);
          els.gross.textContent = money(grossP);
          els.total.textContent = money(totalP);
          els.vatLabel.textContent = `VAT (${rateInfo.valid ? rateInfo.label : DASH})`;
          els.totalLabel.textContent = mode === "add" ? "Gross · incl. VAT" : "Net · excl. VAT";
          els.rateNote.textContent = rateInfo.valid
            ? `at ${rateInfo.label} ${rateInfo.name}`
            : "Enter a valid rate";

          amountLabel.textContent = mode === "add" ? "Amount (net)" : "Amount (gross)";
          amountTag.textContent = mode === "add" ? "NET" : "GROSS";

          if (valid) {
            const factor = 1 + rateInfo.rate / 100;
            const factorText = factorFormat.format(factor);
            formula.textContent =
              mode === "add"
                ? `${gbp.format(pence / 100)} × ${factorText} = ${gbp.format(grossP / 100)}`
                : `${gbp.format(pence / 100)} ÷ ${factorText} = ${gbp.format(netP / 100)}`;
          } else {
            formula.textContent = amountEmpty
              ? "Enter an amount to see the calculation."
              : amountInvalid
                ? "Enter a valid amount to see the calculation."
                : "Enter a valid rate to see the calculation.";
          }

          if (valid && grossP > 0) {
            const netShare = (netP / grossP) * 100;
            const vatShare = 100 - netShare;

            barNet.style.width = `${netShare}%`;
            barVat.style.width = `${vatShare}%`;
            shareNet.textContent = `${netShare.toFixed(1)}%`;
            shareVat.textContent = `${vatShare.toFixed(1)}%`;
          } else {
            barNet.style.width = "0%";
            barVat.style.width = "0%";
            shareNet.textContent = DASH;
            shareVat.textContent = DASH;
          }

          mobileLabel.textContent = els.totalLabel.textContent;
          mobileTotal.textContent = els.total.textContent;
          els.copy.disabled = !valid;
          mobileCopy.disabled = !valid;
          shareButton.disabled = !valid;

          modeHelp.textContent =
            mode === "add"
              ? "Net price → gross price. We add VAT to the amount you enter."
              : "Gross price → net price. We take VAT out of the amount you enter.";

          current.netP = netP;
          current.vatP = vatP;
          current.grossP = grossP;
          current.rateLabel = rateInfo.valid ? rateInfo.label : DASH;
          current.mode = mode;
          current.valid = valid;

          if (hashReady && !suppressHash) {
            if (valid) {
              writeStateHash();
            } else if (/(^|&)amount=/.test(location.hash.slice(1))) {
              try {
                history.replaceState(null, "", "#");
              } catch {
                // Ignore restricted-history environments.
              }
            }
          }

          if (announce) {
            clearTimeout(announceTimer);
            announceTimer = setTimeout(() => {
              status.textContent = valid
                ? `${els.totalLabel.textContent}: ${els.total.textContent}. VAT ${els.vat.textContent} at ${current.rateLabel}.`
                : "Enter a valid amount and rate to see results.";
            }, 500);
          }
        }

        async function copyBreakdown() {
          if (!current.valid) return;

          const text = [
            `Net (excl. VAT): ${gbp.format(current.netP / 100)}`,
            `VAT (${current.rateLabel}): ${gbp.format(current.vatP / 100)}`,
            `Gross (incl. VAT): ${gbp.format(current.grossP / 100)}`,
          ].join("\n");

          const copied = await writeClipboard(text);

          if (!copied) {
            showToast("Could not copy. Please try again.");
            return;
          }

          showToast("Copied to clipboard");
          els.copyText.textContent = "Copied!";
          copyIcon.classList.add("hidden");
          copyCheck.classList.remove("hidden");
          els.copy.classList.add("bg-white/20");

          clearTimeout(copyTimer);
          copyTimer = setTimeout(() => {
            els.copyText.textContent = "Copy";
            copyIcon.classList.remove("hidden");
            copyCheck.classList.add("hidden");
            els.copy.classList.remove("bg-white/20");
          }, 2200);
        }

        async function shareCalculation() {
          if (!current.valid) return;

          const url = stateUrl();
          writeStateHash();

          const copied = await writeClipboard(url);

          if (copied) {
            showToast("Share link copied");
            shareText.textContent = "Link copied";
          } else {
            showToast("Could not copy the link. Copy it from the address bar.");
            shareText.textContent = "Copy failed";
          }

          clearTimeout(shareTimer);
          shareTimer = setTimeout(() => {
            shareText.textContent = "Share";
          }, 2200);
        }

        function syncMobileBar() {
          const shouldShow = !resultsVisible && resultsAbove && !footerVisible;

          mobileBar.classList.toggle("translate-y-full", !shouldShow);
          mobileBar.setAttribute("aria-hidden", String(!shouldShow));

          if (shouldShow) {
            mobileBar.removeAttribute("inert");
          } else {
            mobileBar.setAttribute("inert", "");
          }
        }

        let resultsVisible = true;
        let resultsAbove = false;
        let footerVisible = false;

        if ("IntersectionObserver" in window) {
          const observer = new IntersectionObserver(
            (entries) => {
              entries.forEach((entry) => {
                if (entry.target === resultsPanel) {
                  resultsVisible = entry.isIntersecting;
                  resultsAbove = !entry.isIntersecting && entry.boundingClientRect.bottom <= 0;
                }
                if (entry.target === footer) footerVisible = entry.isIntersecting;
              });
              syncMobileBar();
            },
            { threshold: 0 }
          );

          observer.observe(resultsPanel);
          observer.observe(footer);
        }

        // ----- Main calculator events -----

        form.addEventListener("submit", (event) => event.preventDefault());

        amountInput.addEventListener("input", () => {
          keypadFresh = false;
          update();
        });

        amountInput.addEventListener("blur", () => {
          const parsed = parseAmount(amountInput.value);
          if (!parsed.invalid && !parsed.empty) {
            amountInput.value = parsed.value.toFixed(2);
          }
          keypadFresh = true;
          update();
        });

        modeRadios.forEach((radio) => {
          radio.addEventListener("change", () => update());
        });

        rateRadios.forEach((radio) => {
          radio.addEventListener("change", () => {
            if (radio.value === "custom" && radio.checked) {
              customWrap.classList.remove("hidden");
              customRate.focus();
              customRate.select();
            }
            update();
          });
        });

        customRate.addEventListener("input", () => update());

        customRate.addEventListener("blur", () => {
          const info = getRateInfo();
          if (info.valid && info.name === "custom rate") {
            customRate.value = String(info.rate);
          }
          update();
        });

        document.querySelectorAll("[data-quick]").forEach((button) => {
          button.addEventListener("click", () => {
            amountInput.value = button.dataset.quick;
            keypadFresh = true;
            update();
            amountInput.focus();
          });
        });

        document.getElementById("reset").addEventListener("click", () => {
          amountInput.value = "";
          customRate.value = "";
          modeRadios.forEach((radio) => {
            radio.checked = radio.value === "add";
          });
          rateRadios.forEach((radio) => {
            radio.checked = radio.value === "20";
          });
          customWrap.classList.add("hidden");
          keypadFresh = true;
          update();
          amountInput.focus();
        });

        els.copy.addEventListener("click", copyBreakdown);
        mobileCopy.addEventListener("click", copyBreakdown);
        shareButton.addEventListener("click", shareCalculation);

        // ----- On-screen keypad -----

        if (keypad) {
          keypad.addEventListener("click", (event) => {
            const button = event.target.closest("[data-keypad]");
            if (!button) return;

            const key = button.dataset.keypad;
            let value = amountInput.value.trim().replace(/[£,\s]/g, "");

            if (key === "clear") {
              value = "";
              keypadFresh = false;
            } else if (key === "backspace") {
              value = value.slice(0, -1);
              keypadFresh = false;
            } else if (key === ".") {
              if (keypadFresh || value === "") {
                value = "0.";
                keypadFresh = false;
              } else if (!value.includes(".")) {
                value += ".";
              }
            } else if (keypadFresh) {
              value = key;
              keypadFresh = false;
            } else {
              value += key;
            }

            amountInput.value = value;
            update();
          });
        }

        // ----- Shareable hash state -----

        window.addEventListener("hashchange", () => {
          if (/(^|&)amount=/.test(location.hash.slice(1))) {
            applyStateFromHash();
          }
        });

        // ----- Initial state -----

        update(false);
        applyStateFromHash();
        hashReady = true;
        syncMobileBar();
      })();