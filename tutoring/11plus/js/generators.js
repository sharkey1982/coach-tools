// 11plus/js/generators.js
// Generates fresh random questions for "mechanical" archetypes (no diagram needed).
// Each generator takes a tier index (0=Must Get, 1=Should Get, 2=Strong Candidate, 3=Separator)
// and returns {text, answer, explanation, marks, thinking_skill, importance, domain, topic, archetype}

const GEN = {
  randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; },
  choice(arr) { return arr[this.randInt(0, arr.length - 1)]; },
  gcd(a, b) { a = Math.abs(a); b = Math.abs(b); while (b) { [a, b] = [b, a % b]; } return a || 1; },
  simplifyFrac(num, den) {
    if (den < 0) { num = -num; den = -den; }
    const g = this.gcd(num, den);
    return [num / g, den / g];
  },
  fracStr(num, den) {
    const [n, d] = this.simplifyFrac(num, den);
    if (d === 1) return `${n}`;
    return `${n}/${d}`;
  },
  tierLabel(tier) { return ['Must Get', 'Should Get', 'Strong Candidate', 'Separator'][tier]; }
};

const GENERATORS = {

  "Four operations": {
    domain: "Number", topic: "Arithmetic", thinking_skill: "Automatic Recall",
    generate(tier) {
      const op = GEN.choice(['+', '-', '×', '÷']);
      const digits = [2, 3, 3, 4][tier];
      const max = Math.pow(10, digits) - 1;
      const min = Math.pow(10, digits - 1);
      let a, b, answer, text;
      if (op === '+') {
        a = GEN.randInt(min, max); b = GEN.randInt(min, max);
        answer = a + b; text = `${a} + ${b}`;
      } else if (op === '-') {
        a = GEN.randInt(min, max); b = GEN.randInt(min, a);
        answer = a - b; text = `${a} - ${b}`;
      } else if (op === '×') {
        a = GEN.randInt(min, Math.min(max, 999)); b = GEN.randInt(2, 12);
        answer = a * b; text = `${a} &times; ${b}`;
      } else {
        b = GEN.randInt(2, 12); answer = GEN.randInt(min, max); a = answer * b;
        text = `${a} &divide; ${b}`;
      }
      return { text, answer: `${answer}`, explanation: `Standard ${op === '+' ? 'column addition' : op === '-' ? 'column subtraction' : op === '×' ? 'multiplication' : 'division'}.`, marks: 1, importance: GEN.tierLabel(tier) };
    }
  },

  "Missing number/digit": {
    domain: "Number", topic: "Missing number", thinking_skill: "Reverse Reasoning",
    generate(tier) {
      const max = [30, 100, 500, 2000][tier];
      const a = GEN.randInt(2, max);
      const c = GEN.randInt(2, max);
      const answer = a + c;
      return {
        text: `${a} + <span class="math-box"></span> = ${answer}`,
        answer: `${c}`,
        explanation: `Rearrange: box = ${answer} - ${a} = ${c}.`,
        marks: 1, importance: GEN.tierLabel(tier)
      };
    }
  },

  "Fraction/decimal arithmetic": {
    domain: "Fractions & Decimals", topic: "Fraction arithmetic", thinking_skill: "Calculation",
    generate(tier) {
      const denoms = [[2, 4], [3, 6, 4, 8], [5, 10, 6, 12], [7, 9, 11, 12]][tier];
      const d1 = GEN.choice(denoms), d2 = GEN.choice(denoms);
      const n1 = GEN.randInt(1, d1 - 1), n2 = GEN.randInt(1, d2 - 1);
      const op = GEN.choice(['+', '-']);
      const commonDen = (d1 * d2) / GEN.gcd(d1, d2);
      let numResult;
      if (op === '+') {
        numResult = n1 * (commonDen / d1) + n2 * (commonDen / d2);
      } else {
        numResult = n1 * (commonDen / d1) - n2 * (commonDen / d2);
        if (numResult < 0) { return this.generate(tier); } // retry if it would go negative
      }
      const answer = GEN.fracStr(numResult, commonDen);
      return {
        text: `${n1}/${d1} ${op} ${n2}/${d2}`,
        answer,
        explanation: `Common denominator ${commonDen}: ${n1}/${d1} = ${n1 * (commonDen / d1)}/${commonDen}, ${n2}/${d2} = ${n2 * (commonDen / d2)}/${commonDen}. ${op === '+' ? 'Add' : 'Subtract'} the numerators.`,
        marks: 1, importance: GEN.tierLabel(tier)
      };
    }
  },

  "Percentage of amount": {
    domain: "Percentages", topic: "Single-step %", thinking_skill: "Automatic Recall",
    generate(tier) {
      const pct = GEN.choice([[10, 25, 50], [15, 20, 30, 40], [12.5, 17.5, 35, 45], [8, 22, 62.5, 37.5]][tier]);
      const amount = GEN.randInt(2, [40, 60, 80, 100][tier]) * 10;
      const answer = (pct / 100) * amount;
      return {
        text: `Find ${pct}% of ${amount}`,
        answer: `${Number(answer.toFixed(2))}`,
        explanation: `${pct}% = ${pct}/100. ${pct}% of ${amount} = ${amount} &times; ${pct}/100 = ${Number(answer.toFixed(2))}.`,
        marks: 1, importance: GEN.tierLabel(tier)
      };
    }
  },

  "Reverse percentage": {
    domain: "Percentages", topic: "Reverse percentage", thinking_skill: "Reverse Reasoning",
    generate(tier) {
      const pct = [10, 20, 25, 15][tier];
      const original = GEN.randInt(4, 20) * 5;
      const isIncrease = GEN.choice([true, false]);
      const multiplier = isIncrease ? (100 + pct) / 100 : (100 - pct) / 100;
      const final = Math.round(original * multiplier * 100) / 100;
      return {
        text: `An item's price was ${isIncrease ? 'increased' : 'decreased'} by ${pct}%. It now costs &pound;${final}. What was the original price?`,
        answer: `&pound;${original}`,
        explanation: `The new price represents ${isIncrease ? 100 + pct : 100 - pct}% of the original. Original = &pound;${final} &divide; ${multiplier} = &pound;${original}.`,
        marks: 1, importance: GEN.tierLabel(tier)
      };
    }
  },

  "Unit conversion": {
    domain: "Measures", topic: "Unit conversion", thinking_skill: "Automatic Recall",
    generate(tier) {
      const conversions = [
        { from: 'km', to: 'm', factor: 1000 },
        { from: 'm', to: 'cm', factor: 100 },
        { from: 'cm', to: 'mm', factor: 10 },
        { from: 'kg', to: 'g', factor: 1000 },
        { from: 'l', to: 'ml', factor: 1000 },
        { from: 'm', to: 'mm', factor: 1000 }
      ];
      const c = GEN.choice(conversions);
      const value = tier < 2 ? GEN.randInt(1, 20) : Number((GEN.randInt(10, 999) / 100).toFixed(2));
      const answer = Number((value * c.factor).toFixed(2));
      return {
        text: `How many ${c.to} are there in ${value}${c.from}?`,
        answer: `${answer}`,
        explanation: `1${c.from} = ${c.factor}${c.to}, so multiply by ${c.factor}: ${value} &times; ${c.factor} = ${answer}.`,
        marks: 1, importance: GEN.tierLabel(tier)
      };
    }
  },

  "Area/perimeter (numeric)": {
    domain: "Measures", topic: "Area", thinking_skill: "Application",
    generate(tier) {
      const length = GEN.randInt(3, [10, 15, 25, 40][tier]);
      const width = GEN.randInt(2, length - 1);
      const askArea = GEN.choice([true, false]);
      const answer = askArea ? length * width : 2 * (length + width);
      return {
        text: `A rectangle measures ${length}cm by ${width}cm. Find its ${askArea ? 'area' : 'perimeter'}.`,
        answer: `${answer}${askArea ? 'cm&sup2;' : 'cm'}`,
        explanation: askArea ? `Area = length &times; width = ${length} &times; ${width} = ${answer}cm&sup2;.` : `Perimeter = 2 &times; (length + width) = 2 &times; (${length}+${width}) = ${answer}cm.`,
        marks: 1, importance: GEN.tierLabel(tier)
      };
    }
  },

  "Rate/proportion": {
    domain: "Ratio & Proportion", topic: "Rate/proportion", thinking_skill: "Application",
    generate(tier) {
      const rate = GEN.randInt(2, 8);
      const perUnit = GEN.randInt(2, [10, 20, 40, 80][tier]);
      const multiplier = GEN.randInt(2, 6);
      const target = perUnit * multiplier;
      const answer = rate * multiplier;
      return {
        text: `A car uses ${rate} litres of fuel to travel ${perUnit}km. How much fuel is needed to travel ${target}km?`,
        answer: `${answer} litres`,
        explanation: `${target}km is ${multiplier} times ${perUnit}km, so fuel needed = ${multiplier} &times; ${rate} = ${answer} litres.`,
        marks: 1, importance: GEN.tierLabel(tier)
      };
    }
  },

  "Mean (forward)": {
    domain: "Statistics & Data", topic: "Mean/average", thinking_skill: "Calculation",
    generate(tier) {
      const count = [3, 4, 5, 6][tier];
      const nums = Array.from({ length: count }, () => GEN.randInt(1, [20, 40, 60, 100][tier]));
      const sum = nums.reduce((a, b) => a + b, 0);
      const answer = Number((sum / count).toFixed(2));
      return {
        text: `Find the mean of: ${nums.join(', ')}`,
        answer: `${answer}`,
        explanation: `Sum = ${sum}, count = ${count}, mean = ${sum} &divide; ${count} = ${answer}.`,
        marks: 1, importance: GEN.tierLabel(tier)
      };
    }
  },

  "Mean (reverse)": {
    domain: "Statistics & Data", topic: "Mean/average", thinking_skill: "Reverse Reasoning",
    generate(tier) {
      const count = GEN.randInt(4, [6, 8, 10, 14][tier]);
      const mean = GEN.randInt(5, 20);
      const total = count * mean;
      return {
        text: `The mean of ${count} numbers is ${mean}. Find their total.`,
        answer: `${total}`,
        explanation: `Total = mean &times; count = ${mean} &times; ${count} = ${total}.`,
        marks: 1, importance: GEN.tierLabel(tier)
      };
    }
  },

  "Sequence forward term": {
    domain: "Sequences", topic: "Linear sequences", thinking_skill: "Pattern Recognition",
    generate(tier) {
      const first = GEN.randInt(1, 10);
      const diff = GEN.randInt(2, [5, 7, 9, 12][tier]);
      const n = GEN.randInt(6, [10, 15, 25, 50][tier]);
      const answer = first + diff * (n - 1);
      return {
        text: `A sequence starts at ${first} and adds ${diff} each term (${first}, ${first + diff}, ${first + 2 * diff}...). Find term number ${n}.`,
        answer: `${answer}`,
        explanation: `nth term = ${first} + ${diff}(n-1). For n=${n}: ${first} + ${diff}&times;${n - 1} = ${answer}.`,
        marks: 1, importance: GEN.tierLabel(tier)
      };
    }
  },

  "Sequence reverse term": {
    domain: "Sequences", topic: "Linear sequences", thinking_skill: "Reverse Reasoning",
    generate(tier) {
      const first = GEN.randInt(1, 10);
      const diff = GEN.randInt(2, [5, 7, 9, 12][tier]);
      const n = GEN.randInt(6, [10, 15, 25, 50][tier]);
      const target = first + diff * (n - 1);
      return {
        text: `A sequence starts at ${first} and adds ${diff} each term. At which term does it reach ${target}?`,
        answer: `${n}th`,
        explanation: `Set up: ${first} + ${diff}(n-1) = ${target}. Solve: n-1 = ${(target - first) / diff}, so n = ${n}.`,
        marks: 1, importance: GEN.tierLabel(tier)
      };
    }
  },

  "Letter-substitution ratio system": {
    domain: "Ratio & Proportion", topic: "Letter-substitution ratio system", thinking_skill: "Multi-stage Planning",
    generate(tier) {
      const c = GEN.randInt(2, [6, 10, 15, 25][tier]);
      const kB = GEN.randInt(2, 4), kA = GEN.randInt(2, 3);
      const b = kB * c, a = kA * b;
      const total = a + b + c;
      return {
        text: `A is ${kA === 2 ? 'double' : kA + ' times'} B, and B is ${kB} times C. If A+B+C=${total}, find C.`,
        answer: `${c}`,
        explanation: `Express in terms of C: B=${kB}C, A=${kA}&times;${kB}C=${kA * kB}C. Sum: ${kA * kB}C+${kB}C+C=${kA * kB + kB + 1}C=${total}, so C=${c}.`,
        marks: 1, importance: GEN.tierLabel(tier)
      };
    }
  },

  "Money/amount division in ratio": {
    domain: "Ratio & Proportion", topic: "Money division in ratio", thinking_skill: "Multi-stage Planning",
    generate(tier) {
      const smaller = GEN.randInt(5, [20, 30, 40, 60][tier]);
      const extra = GEN.randInt(2, 12);
      const larger = smaller + extra;
      const total = smaller + larger;
      return {
        text: `&pound;${total} is divided between two people so one gets &pound;${extra} more than the other. How much does the person with less get?`,
        answer: `&pound;${smaller}`,
        explanation: `If the smaller share is S, the larger is S+${extra}. S+(S+${extra})=${total}, so 2S=${total - extra}, S=${smaller}.`,
        marks: 1, importance: GEN.tierLabel(tier)
      };
    }
  },

  "'Think of a number' reverse reasoning": {
    domain: "Algebra", topic: "Reverse reasoning", thinking_skill: "Reverse Reasoning",
    generate(tier) {
      const n = GEN.randInt(3, [12, 20, 35, 60][tier]);
      const k = GEN.randInt(3, 17);
      const result = n * k;
      return {
        text: `Someone thinks of a number, multiplies it by ${k}, and gets ${result}. What was the original number?`,
        answer: `${n}`,
        explanation: `Reverse the operation: ${result} &divide; ${k} = ${n}.`,
        marks: 1, importance: GEN.tierLabel(tier)
      };
    }
  },

  "Function/formula machine (forward)": {
    domain: "Algebra", topic: "Function/formula machines", thinking_skill: "Calculation",
    generate(tier) {
      const mult = GEN.randInt(2, 5), add = GEN.randInt(1, 10);
      const input = GEN.randInt(2, [15, 25, 40, 60][tier]);
      const answer = input * mult + add;
      return {
        text: `A machine multiplies the input by ${mult} then adds ${add}. If the input is ${input}, find the output.`,
        answer: `${answer}`,
        explanation: `${input} &times; ${mult} = ${input * mult}, then + ${add} = ${answer}.`,
        marks: 1, importance: GEN.tierLabel(tier)
      };
    }
  },

  "Function/formula machine (reverse)": {
    domain: "Algebra", topic: "Function/formula machines", thinking_skill: "Reverse Reasoning",
    generate(tier) {
      const mult = GEN.randInt(2, 5), add = GEN.randInt(1, 10);
      const input = GEN.randInt(2, [15, 25, 40, 60][tier]);
      const output = input * mult + add;
      return {
        text: `A machine multiplies the input by ${mult} then adds ${add}. If the output is ${output}, find the input.`,
        answer: `${input}`,
        explanation: `Reverse in opposite order: subtract ${add} first (${output}-${add}=${output - add}), then divide by ${mult}: ${output - add} &divide; ${mult} = ${input}.`,
        marks: 1, importance: GEN.tierLabel(tier)
      };
    }
  },

  "Rounding & bounds": {
    domain: "Number", topic: "Rounding & bounds", thinking_skill: "Logical Deduction",
    generate(tier) {
      const roundTo = GEN.choice([10, 100]);
      const rounded = GEN.randInt(5, 50) * roundTo;
      const half = roundTo / 2;
      const askMax = GEN.choice([true, false]);
      const answer = askMax ? rounded + half - 1 : rounded - half;
      return {
        text: `A number rounds to ${rounded} when rounded to the nearest ${roundTo}. Find the ${askMax ? 'largest' : 'smallest'} possible value of that number.`,
        answer: `${answer}`,
        explanation: `Rounding to the nearest ${roundTo} means the true value is within ${half} of ${rounded}: from ${rounded - half} up to ${rounded + half - 1}. ${askMax ? 'Largest' : 'Smallest'} is ${answer}.`,
        marks: 1, importance: GEN.tierLabel(tier)
      };
    }
  },

  "Algebraic angle geometry": {
    domain: "Geometry", topic: "Angles", thinking_skill: "Calculation",
    generate(tier) {
      const sumOptions = [[3, 5, 6], [4, 6, 9, 10], [9, 10, 12, 15], [12, 15, 18, 20]][tier];
      const sum = GEN.choice(sumOptions);
      const a = GEN.randInt(1, sum - 2);
      const b = GEN.randInt(1, sum - a - 1);
      const c = sum - a - b;
      const x = 180 / sum;
      return {
        text: `A triangle has angles ${a}x, ${b}x and ${c}x. Find x.`,
        answer: `${x}`,
        explanation: `Angles in a triangle sum to 180&deg;: ${a}x+${b}x+${c}x=${sum}x=180, so x=${x}.`,
        marks: 1, importance: GEN.tierLabel(tier)
      };
    }
  },

  "Number properties/logic": {
    domain: "Number", topic: "Number properties", thinking_skill: "Logical Deduction",
    generate(tier) {
      const primes = [2,3,5,7,11,13,17,19,23,29,31,37,41,43,47,53,59,61,67,71,73,79,83,89,97,101,103,107,109,113];
      const diff = GEN.choice([2, 4, 6, tier > 1 ? GEN.choice([10, 12]) : 2]);
      // find all prime pairs with this difference
      const pairs = [];
      for (const p of primes) { if (primes.includes(p + diff)) pairs.push([p, p + diff]); }
      if (pairs.length === 0) return this.generate(tier);
      const [p1, p2] = GEN.choice(pairs);
      return {
        text: `Find a pair of prime numbers with a difference of ${diff}.`,
        answer: `${p1} and ${p2} (other valid pairs may also exist)`,
        explanation: `List primes in order and check consecutive/nearby pairs for a difference of ${diff}. ${p1} and ${p2} both are prime and ${p2}-${p1}=${diff}.`,
        marks: 1, importance: GEN.tierLabel(tier)
      };
    }
  },

  "Always/sometimes/never true reasoning": {
    domain: "Logic & Reasoning", topic: "Always/sometimes/never", thinking_skill: "Logical Deduction",
    bank: [
      { s: "The sum of two even numbers is even", a: "Always", e: "Any two even numbers can be written as 2a and 2b; their sum 2a+2b=2(a+b) is always even." },
      { s: "The sum of two odd numbers is odd", a: "Never", e: "Two odd numbers written as 2a+1 and 2b+1 sum to 2a+2b+2=2(a+b+1), always even, never odd." },
      { s: "A square number is even", a: "Sometimes", e: "4 and 16 are square and even; 9 and 25 are square and odd - both occur." },
      { s: "Multiplying two odd numbers gives an odd number", a: "Always", e: "Odd&times;odd is always odd, since neither factor contributes a factor of 2." },
      { s: "The average of three consecutive numbers is a whole number", a: "Always", e: "Three consecutive numbers are n, n+1, n+2, summing to 3n+3=3(n+1); dividing by 3 gives n+1, always whole." },
      { s: "A prime number is odd", a: "Sometimes", e: "2 is prime and even; all other primes are odd - so sometimes, not always." },
      { s: "The product of two square numbers is a square number", a: "Always", e: "a&sup2;&times;b&sup2;=(ab)&sup2;, always a perfect square." },
      { s: "A number and its reverse (digits swapped) have the same digit sum", a: "Always", e: "Reversing digits doesn't change which digits are being added, just their order - the sum is unaffected." }
    ],
    generate(tier) {
      const item = GEN.choice(this.bank);
      return {
        text: `Is this statement always, sometimes, or never true: "${item.s}"?`,
        answer: item.a,
        explanation: item.e,
        marks: 1, importance: GEN.tierLabel(tier)
      };
    }
  }
};

const GENERATABLE_ARCHETYPES = Object.keys(GENERATORS);
