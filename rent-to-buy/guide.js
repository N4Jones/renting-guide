/* Rent to Buy guide: interactive tools */
(function () {
  "use strict";

  // Verified 23 Oct 2026 against gov.uk/lifetime-isa
  var LISA = {
    annualLimit: 4000,
    bonusRate: 0.25,
    maxBonus: 1000,
    openMinAge: 18,
    openMaxAge: 39,
    payInUntil: 50,
    priceCap: 450000,
    minMonthsOpen: 12,
    withdrawalCharge: 0.25
  };
  var LISA_MONTHLY_CAP = LISA.annualLimit / 12;

  var gbp0 = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 });
  function money(n) { return gbp0.format(Math.round(n || 0)); }
  function num(v) { var n = parseFloat(v); return isFinite(n) && n > 0 ? n : 0; }

  /* ---------------- Eligibility checker ---------------- */

  var QUESTIONS = [
    {
      id: "work",
      q: "Is at least one person in your household in paid work?",
      help: "Employed or self-employed both count.",
      answers: [
        { label: "Yes", result: ["ok", "At least one of you is in paid work."] },
        { label: "No", result: ["bad", "Rent to Buy is for working households, so at least one applicant needs to be in paid work."] }
      ]
    },
    {
      id: "own",
      q: "Do you currently own a home, anywhere?",
      help: "In the UK or abroad, on your own or jointly.",
      answers: [
        { label: "Yes", result: ["bad", "You can't own another home while on Rent to Buy."] },
        { label: "No", result: ["ok", "You don't currently own a home."] }
      ]
    },
    {
      id: "owned",
      q: "Have you ever owned a home before?",
      help: "Answer no if this would be your first home.",
      answers: [
        { label: "Yes", result: ["check", "GOV.UK says Rent to Buy is for first-time buyers, unless you're returning to ownership after a relationship breakdown. Some providers also accept former owners who can't afford to buy now, so ask."] },
        { label: "No", result: ["ok", "You're a first-time buyer."] }
      ]
    },
    {
      id: "region",
      q: "Where do you want to live?",
      help: "Rules differ in London.",
      answers: [
        { label: "London", value: "london", result: ["ok", "In London you'd apply for London Living Rent, the London version of the scheme."] },
        { label: "Elsewhere in England", value: "england", result: ["ok", "Rent to Buy runs across England outside London."] },
        { label: "Scotland, Wales or NI", value: "other", result: ["bad", "Rent to Buy isn't available in Scotland. Wales and Northern Ireland have separate Rent to Own schemes with their own rules."] }
      ]
    },
    {
      id: "income",
      skipIf: function (a) { return a.region === "other"; },
      q: function (a) {
        return a.region === "london"
          ? "Is your total household income £75,000 a year or less?"
          : "Is your total household income £80,000 a year or less?";
      },
      help: "Add up everyone who's applying, before tax.",
      answers: [
        { label: "Yes", result: function (a) {
          return a.region === "london"
            ? ["ok", "Your income is within the £75,000 London Living Rent cap providers currently list."]
            : ["ok", "Your income is within the £80,000 limit most providers use."];
        } },
        { label: "No", result: function (a) {
          return a.region === "london"
            ? ["bad", "London Living Rent providers currently cap household income at £75,000. Shared Ownership may still be an option, so check."]
            : ["check", "There's no national income cap for Rent to Buy, but most providers we checked use £80,000. Some, like L&Q, set no maximum."];
        } }
      ]
    },
    {
      id: "afford",
      q: "Could you afford to buy a suitable home where you want to live right now?",
      help: "For most people the blocker is the deposit.",
      answers: [
        { label: "Yes", result: ["bad", "Rent to Buy is for people who can't buy yet, usually because they don't have a deposit."] },
        { label: "No", result: ["ok", "You can't buy locally yet, which is who the scheme is for."] }
      ]
    },
    {
      id: "credit",
      q: "Is your credit history free of CCJs, defaults, IVAs and bankruptcy?",
      help: "If you're not sure, check your report with Experian, Equifax or TransUnion.",
      answers: [
        { label: "Yes", result: ["ok", "Your credit history looks clear."] },
        { label: "No", result: ["check", "Serious credit issues can rule you out. Check your report, then ask the provider how they treat it."] }
      ]
    },
    {
      id: "only",
      q: "Will this be your only home?",
      help: "You'll need to live there yourself.",
      answers: [
        { label: "Yes", result: ["ok", "It would be your only home."] },
        { label: "No", result: ["bad", "Rent to Buy must be your only home. It can't be a second property."] }
      ]
    },
    {
      id: "sublet",
      q: "Are you happy not to sublet or take in lodgers?",
      help: "This is a standard condition of the tenancy.",
      answers: [
        { label: "Yes", result: ["ok", "You won't sublet or take in lodgers."] },
        { label: "No", result: ["bad", "You can't sublet the home or take in lodgers during the tenancy."] }
      ]
    }
  ];

  function activeQuestions(answers) {
    return QUESTIONS.filter(function (q) { return !(q.skipIf && q.skipIf(answers)); });
  }

  // answers: { questionId: answerIndex }, returns { verdict, reasons }
  function evaluate(answerIdx) {
    var values = {};
    QUESTIONS.forEach(function (q) {
      if (answerIdx[q.id] != null) {
        var a = q.answers[answerIdx[q.id]];
        values[q.id] = a.value || a.label;
      }
    });
    var reasons = [];
    activeQuestions(values).forEach(function (q) {
      if (answerIdx[q.id] == null) return;
      var a = q.answers[answerIdx[q.id]];
      var r = typeof a.result === "function" ? a.result(values) : a.result;
      reasons.push({ status: r[0], text: r[1] });
    });
    var has = function (s) { return reasons.some(function (r) { return r.status === s; }); };
    var verdict = has("bad") ? "no" : has("check") ? "check" : "good";
    return { verdict: verdict, reasons: reasons, values: values };
  }

  function initChecker() {
    var root = document.getElementById("checker");
    if (!root) return;
    var answers = {};
    var history = [];

    function valuesNow() { return evaluate(answers).values; }

    function nextQuestion() {
      var list = activeQuestions(valuesNow());
      for (var i = 0; i < list.length; i++) if (answers[list[i].id] == null) return { q: list[i], index: i, total: list.length };
      return null;
    }

    function el(tag, cls, text) {
      var e = document.createElement(tag);
      if (cls) e.className = cls;
      if (text != null) e.textContent = text;
      return e;
    }

    function render(focus) {
      root.innerHTML = "";
      var nxt = nextQuestion();
      if (nxt) {
        var q = nxt.q;
        root.appendChild(el("p", "step", "Question " + (nxt.index + 1) + " of " + nxt.total));
        var bar = el("div", "steps-bar");
        var fill = el("span");
        fill.style.width = (nxt.index / nxt.total) * 100 + "%";
        bar.appendChild(fill);
        root.appendChild(bar);
        var h = el("p", "q", typeof q.q === "function" ? q.q(valuesNow()) : q.q);
        h.tabIndex = -1;
        h.id = "checker-q";
        root.appendChild(h);
        root.appendChild(el("p", "help", q.help));
        var row = el("div", "answers");
        row.setAttribute("role", "group");
        row.setAttribute("aria-labelledby", "checker-q");
        q.answers.forEach(function (a, idx) {
          var b = el("button", "btn" + (q.answers.length > 2 || idx === 1 ? " ghost" : ""), a.label);
          b.type = "button";
          b.addEventListener("click", function () {
            answers[q.id] = idx;
            history.push(q.id);
            render(true);
          });
          row.appendChild(b);
        });
        root.appendChild(row);
        if (history.length) {
          var back = el("button", "back", "Back");
          back.type = "button";
          back.addEventListener("click", function () {
            var last = history.pop();
            delete answers[last];
            // clear answers that no longer apply
            render(true);
          });
          root.appendChild(back);
        }
        if (focus) h.focus();
        return;
      }

      var res = evaluate(answers);
      var titles = {
        good: "Looks like you could be eligible",
        check: "Worth checking with the provider",
        no: "Not eligible yet"
      };
      var v = el("div", "verdict " + res.verdict);
      var vh = el("h3", null, titles[res.verdict]);
      vh.tabIndex = -1;
      v.appendChild(vh);
      root.appendChild(v);
      var ul = el("ul", "reasons");
      var order = { bad: 0, check: 1, ok: 2 };
      res.reasons.slice().sort(function (a, b) { return order[a.status] - order[b.status]; }).forEach(function (r) {
        var li = el("li");
        var tag = el("span", "tag " + (r.status === "ok" ? "ok" : r.status === "check" ? "warn" : "bad"), r.status === "ok" ? "OK" : r.status === "check" ? "?" : "NO");
        tag.setAttribute("aria-label", r.status === "ok" ? "Meets" : r.status === "check" ? "Check" : "Doesn't meet");
        li.appendChild(tag);
        li.appendChild(el("span", null, r.text));
        ul.appendChild(li);
      });
      root.appendChild(ul);
      root.appendChild(el("p", "note", "Each housing association sets its own rules, so always read their full criteria before applying. This checker is for information only."));
      var again = el("button", "btn", "Start again");
      again.type = "button";
      again.style.marginTop = "20px";
      again.addEventListener("click", function () { answers = {}; history = []; render(true); });
      root.appendChild(again);
      if (focus) vh.focus();
    }
    render(false);
  }

  /* ---------------- Savings calculator ---------------- */

  function calc(i) {
    var rent = num(i.rent), discount = Math.min(num(i.discount), 100), months = Math.round(num(i.months));
    var existing = num(i.existing), price = num(i.price);
    var out = { warnings: [] };
    out.monthly = rent * discount / 100;
    out.saved = out.monthly * months;
    out.contrib = 0; out.extra = 0; out.bonus = 0; out.penalty = 0; out.lisaMonths = 0; out.lisaMonthly = 0;
    out.bonusUsable = true;

    if (i.lisaOn) {
      var age = Math.floor(num(i.age));
      var wanted = num(i.lisa);
      var monthly = Math.min(wanted, LISA_MONTHLY_CAP);
      if (wanted > LISA_MONTHLY_CAP) out.warnings.push("Lifetime ISA payments are capped at £4,000 a year, so we've used " + money(LISA_MONTHLY_CAP) + " a month.");
      var allowed = true;
      if (age < LISA.openMinAge) {
        allowed = false;
        out.warnings.push("You need to be 18 to open a Lifetime ISA, so we've left it out.");
      } else if (age >= LISA.payInUntil) {
        allowed = false;
        out.warnings.push("You can't pay into a Lifetime ISA from age 50, so we've left it out.");
      } else if (age > LISA.openMaxAge) {
        out.warnings.push("You can only open a Lifetime ISA before you turn 40. We've included it assuming you already have one.");
      }
      if (allowed) {
        var lisaMonths = Math.min(months, Math.max(0, (LISA.payInUntil - age) * 12));
        if (lisaMonths < months) out.warnings.push("Payments stop at 50, so we've counted " + lisaMonths + " months of Lifetime ISA payments.");
        out.lisaMonths = lisaMonths;
        out.lisaMonthly = monthly;
        out.contrib = monthly * lisaMonths;
        out.bonus = out.contrib * LISA.bonusRate;
        out.extra = Math.max(0, out.contrib - out.saved);
        if (lisaMonths < LISA.minMonthsOpen && out.contrib > 0) {
          out.warnings.push("Your Lifetime ISA needs to be open for 12 months from your first payment before you can use it to buy.");
        }
        if (price > LISA.priceCap && out.contrib > 0) {
          out.bonusUsable = false;
          out.penalty = (out.contrib + out.bonus) * LISA.withdrawalCharge - out.bonus;
          out.warnings.push("Lifetime ISA money can only go towards a first home costing £450,000 or less. On this price you'd pay a 25% charge to take it out, so we've removed the bonus and the charge from your pot.");
        }
      }
    }
    out.bonusCounted = out.bonusUsable ? out.bonus : 0;
    out.pot = existing + out.saved + out.extra + out.bonusCounted - out.penalty;
    out.pct = price > 0 ? (out.pot / price) * 100 : null;
    out.existing = existing; out.rent = rent; out.discount = discount; out.months = months; out.price = price;
    return out;
  }

  function initCalc() {
    var form = document.getElementById("calc");
    if (!form) return;
    var $ = function (id) { return document.getElementById(id); };
    var lisaOn = $("lisa-on"), lisaFields = $("lisa-fields");

    function update() {
      lisaFields.hidden = !lisaOn.checked;
      var r = calc({
        rent: $("rent").value, discount: $("discount").value, months: $("months").value,
        existing: $("existing").value, price: $("price").value,
        lisaOn: lisaOn.checked, age: $("age").value, lisa: $("lisa").value
      });
      $("out-monthly").textContent = money(r.monthly);
      $("out-total").textContent = money(r.saved);
      $("out-bonus").textContent = money(r.bonusCounted);
      $("out-pot").textContent = money(r.pot);
      $("out-pct").textContent = r.pct == null ? "Add a price" : r.pct.toFixed(1) + "%";

      var total = r.existing + r.saved + r.extra + r.bonusCounted;
      var pc = function (n) { return total > 0 ? (n / total) * 100 + "%" : "0%"; };
      $("seg-existing").style.width = pc(r.existing);
      $("seg-saved").style.width = pc(r.saved + r.extra - r.penalty);
      $("seg-bonus").style.width = pc(r.bonusCounted);
      $("bar").setAttribute("aria-label",
        "Deposit pot: " + money(r.existing) + " existing savings, " + money(r.saved + r.extra - r.penalty) + " saved, " + money(r.bonusCounted) + " Lifetime ISA bonus");

      var w = [];
      w.push(money(r.rent) + " market rent at a " + r.discount + "% discount saves you " + money(r.monthly) + " a month.");
      w.push(money(r.monthly) + " a month for " + r.months + " months adds up to " + money(r.saved) + ".");
      if (r.contrib > 0) {
        var fromRent = Math.min(r.contrib, r.saved);
        var line = "You pay " + money(r.lisaMonthly) + " a month into a Lifetime ISA for " + r.lisaMonths + " months, " + money(r.contrib) + " in total. We count the first " + money(fromRent) + " as coming from your rent saving";
        line += r.extra > 0 ? ", and the other " + money(r.extra) + " as extra saving." : ".";
        w.push(line);
        if (r.bonusUsable) w.push("The government adds 25% on top, a bonus of " + money(r.bonus) + ".");
        else w.push("The 25% withdrawal charge would cost you " + money(r.bonus + r.penalty) + ", wiping out the bonus and " + money(r.penalty) + " of your own money.");
      }
      var parts = [money(r.existing) + " you had", money(r.saved) + " rent saving"];
      if (r.extra > 0) parts.push(money(r.extra) + " extra");
      if (r.bonusCounted > 0) parts.push(money(r.bonusCounted) + " bonus");
      var sum = parts.join(" + ");
      if (r.penalty > 0) sum += " minus " + money(r.penalty) + " charge";
      w.push(sum + " gives a pot of " + money(r.pot) + ".");
      if (r.pct != null) w.push("That's " + r.pct.toFixed(1) + "% of a " + money(r.price) + " home. Lenders typically want at least 5% to 10%.");
      var box = $("workings");
      box.innerHTML = "";
      w.forEach(function (t) { var p = document.createElement("p"); p.textContent = t; box.appendChild(p); });

      var warn = $("warnings");
      warn.innerHTML = "";
      r.warnings.forEach(function (t) { var p = document.createElement("p"); p.className = "note"; p.textContent = t; warn.appendChild(p); });
    }
    form.addEventListener("input", update);
    form.addEventListener("change", update);
    update();
  }

  /* ---------------- Property finder ---------------- */

  // Checked 23 Oct 2026. status: "confirmed" = provider's own site says it offers Rent to Buy (or London Living Rent).
  // emailVerified: false = from the original guide, not found on the provider's site.
  var PROVIDERS = [
    { area: "Greater London", name: "Share to Buy", url: "https://www.sharetobuy.com/", status: "confirmed",
      desc: "Portal listing London Living Rent homes in London, plus Rent to Buy homes elsewhere.", email: null },
    { area: "Guildford", name: "Abri", url: "https://www.abrihomes.co.uk/help-advice/looking-for-a-home-to-rent", status: "confirmed",
      desc: "Rent 20% below market rent. Household income under £80,000.", email: "hello@abri.co.uk", emailVerified: true },
    { area: "Guildford", name: "Stonewater", url: "https://stonewaterhomes.co.uk/", status: "confirmed",
      desc: "Pay 80% of market rent and save the rest. Five year tenancies.", email: "propertylistings@stonewater.org", emailVerified: false },
    { area: "Milton Keynes", name: "Domovo Homes (bpha)", url: "https://domovohomes.co.uk/", status: "check",
      desc: "Shared Ownership sales brand for bpha. Ask whether Rent to Buy homes are available.", email: "Sales@domovohomes.co.uk", emailVerified: false },
    { area: "Milton Keynes", name: "L&Q", url: "https://lqhomes.com/renting-with-lq/rent-to-buy-homes/", status: "confirmed",
      desc: "Rent to Buy outside London with a two year tenancy. No maximum income. Check listings for current locations.", email: "RTBApplications@lqgroup.org.uk", emailVerified: true },
    { area: "Cambridge", name: "Soresi", url: "https://soresi.co.uk/", status: "check",
      desc: "We couldn't verify this provider. Check the website before relying on it.", email: null },
    { area: "Bedford", name: "Platform Home Ownership", url: "https://platformhomeownership.com/article/introduction-rent-buy", status: "confirmed",
      desc: "Up to five years renting. Household income under £80,000. Check listings for current locations.", email: "sales@platformhg.com", emailVerified: false },
    { area: "Kent", name: "Moat", url: "https://www.moathomes.co.uk/", status: "check",
      desc: "Shared Ownership across Kent, Essex and Sussex. Ask whether Rent to Buy homes are available.", email: "sharetobuy@moathomes.co.uk", emailVerified: true },
    { area: "Chelmsford", name: "CHP", url: "https://www.chp.org.uk/", status: "check",
      desc: "Essex housing association. Ask whether Rent to Buy homes are available.", email: "enquiries@chp.org.uk", emailVerified: true },
    { area: "Hertfordshire", name: "Hightown", url: "https://hightownha.org.uk/find-a-home/rent-to-buy", status: "confirmed",
      desc: "Rent 20% below local market rent. Household income £80,000 or less.", email: "sales@hightownha.org.uk", emailVerified: false }
  ];

  function initFinder() {
    var list = document.getElementById("finder-list");
    if (!list) return;
    var chipsBox = document.getElementById("finder-chips");
    var search = document.getElementById("finder-q");
    var count = document.getElementById("finder-count");
    var areas = ["All areas"];
    PROVIDERS.forEach(function (p) { if (areas.indexOf(p.area) === -1) areas.push(p.area); });
    var current = "All areas";

    areas.forEach(function (a) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "chip";
      b.textContent = a;
      b.setAttribute("aria-pressed", String(a === current));
      b.addEventListener("click", function () {
        current = a;
        chipsBox.querySelectorAll(".chip").forEach(function (c) { c.setAttribute("aria-pressed", String(c.textContent === a)); });
        render();
      });
      chipsBox.appendChild(b);
    });

    function card(p) {
      var c = document.createElement("article");
      c.className = "card provider";
      var top = document.createElement("div");
      top.className = "top";
      var area = document.createElement("span");
      area.className = "pill soft";
      area.textContent = p.area;
      var st = document.createElement("span");
      st.className = "pill" + (p.status === "confirmed" ? "" : " soft");
      st.textContent = p.status === "confirmed" ? "Offers Rent to Buy" : "Check with provider";
      if (p.area === "Greater London") st.textContent = "London Living Rent";
      top.appendChild(area); top.appendChild(st);
      c.appendChild(top);
      var h = document.createElement("h3"); h.textContent = p.name; c.appendChild(h);
      var d = document.createElement("p"); d.className = "desc"; d.textContent = p.desc; c.appendChild(d);
      var a = document.createElement("a");
      a.className = "btn small"; a.href = p.url; a.target = "_blank"; a.rel = "noopener";
      a.textContent = "Visit website";
      a.setAttribute("aria-label", "Visit " + p.name + " website (opens in a new tab)");
      c.appendChild(a);
      var e = document.createElement("div");
      e.className = "email";
      if (p.email) {
        var wrap = document.createElement("div");
        var code = document.createElement("code"); code.textContent = p.email;
        wrap.appendChild(code);
        if (!p.emailVerified) {
          var t = document.createElement("span"); t.className = "tagline"; t.textContent = "From the original guide. Check on their site.";
          wrap.appendChild(t);
        }
        var copy = document.createElement("button");
        copy.type = "button"; copy.className = "btn ghost small";
        copy.setAttribute("data-copy", p.email);
        copy.setAttribute("aria-label", "Copy " + p.name + " email address");
        copy.textContent = "Copy";
        e.appendChild(wrap); e.appendChild(copy);
      } else {
        var s = document.createElement("span"); s.className = "muted"; s.textContent = "Contact through the website";
        e.appendChild(s);
      }
      c.appendChild(e);
      return c;
    }

    function render() {
      var q = (search.value || "").trim().toLowerCase();
      var shown = PROVIDERS.filter(function (p) {
        var inArea = current === "All areas" || p.area === current;
        var hay = (p.area + " " + p.name + " " + p.desc + " " + p.url + " " + (p.email || "")).toLowerCase();
        return inArea && (!q || hay.indexOf(q) !== -1);
      });
      list.innerHTML = "";
      shown.forEach(function (p) { list.appendChild(card(p)); });
      if (!shown.length) {
        var empty = document.createElement("p");
        empty.className = "note empty";
        empty.textContent = "No providers match that. Try another area, or use the GOV.UK search below.";
        list.appendChild(empty);
      }
      count.textContent = "Showing " + shown.length + " of " + PROVIDERS.length + " providers";
    }
    search.addEventListener("input", render);
    render();
  }

  /* ---------------- Comparison toggle ---------------- */

  function initCompare() {
    var btns = document.querySelectorAll(".compare-toggle .chip");
    var cols = document.querySelectorAll(".compare-col");
    function show(which) {
      btns.forEach(function (b) { b.setAttribute("aria-pressed", String(b.getAttribute("data-show") === which)); });
      cols.forEach(function (c) { c.classList.toggle("is-hidden", c.getAttribute("data-col") !== which); });
    }
    btns.forEach(function (b) { b.addEventListener("click", function () { show(b.getAttribute("data-show")); }); });
    show("rtb");
  }

  window.RTB = { calc: calc, evaluate: evaluate, QUESTIONS: QUESTIONS, PROVIDERS: PROVIDERS, LISA: LISA };

  function init() { initChecker(); initCalc(); initFinder(); initCompare(); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
