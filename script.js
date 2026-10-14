"use strict";

// La tabla fija precedencia, asociatividad y número de argumentos por operador
const OPERATORS = {
  "+": { precedence: 1, associativity: "left", arity: 2 },
  "-": { precedence: 1, associativity: "left", arity: 2 },
  "*": { precedence: 2, associativity: "left", arity: 2 },
  "/": { precedence: 2, associativity: "left", arity: 2 },
  "u-": { precedence: 3, associativity: "right", arity: 1 },
  "^": { precedence: 4, associativity: "right", arity: 2 }
};

// Guardamos los elementos del DOM que iremos modificando
const form = document.querySelector("#expression-form");
const expressionInput = document.querySelector("#expression");
const errorMessage = document.querySelector("#error-message");
const rpnOutput = document.querySelector("#rpn-output");
const tacOutput = document.querySelector("#tac-output");
const quadOutput = document.querySelector("#quad-output");
const statusOutput = document.querySelector("#result-status");
const walkthroughContent = document.querySelector("#walkthrough-content");

// Enviar el formulario para calcular todo y solo se actualiza los resultados si se tiene éxito
form.addEventListener("submit", (event) => {
  event.preventDefault(); // Impide la recarga automática del documento
  hideError();
  try {
    const expression = expressionInput.value.trim();
    const tokens = tokenize(expression);
    const postfixTokens = toPostfix(tokens);
    const result = buildIntermediateCode(postfixTokens);
    renderResults(expression, postfixTokens, result);
  } catch (error) {
    showError(error.message);
  }
});

// El botón de ejemplo repone a+b*c+d y lo procesa de nuevo.
document.querySelector("#example-button").addEventListener("click", () => {
  expressionInput.value = "a+b*c+d";
  form.requestSubmit();
});

/**
 * Divide la entrada en nombres, números, operadores y paréntesis.
 * @param {string} expression Expresión escrita.
 * @returns {string[]} Lista ordenada de tokens.
 */
function tokenize(expression) {
  if (expression.length === 0) throw new Error("Escribe una expresión antes de transformarla.");
  const tokens = [];
  let position = 0;

  // position recorre la cadena; cada vuelta consume espacios o un token.
  while (position < expression.length) {
    const remaining = expression.slice(position);
    const whitespace = remaining.match(/^\s+/);
    if (whitespace) { position += whitespace[0].length; continue; }

    const identifier = remaining.match(/^[A-Za-z_][A-Za-z0-9_]*/);
    const number = remaining.match(/^(?:\d+(?:\.\d*)?|\.\d+)/);
    if (identifier) { tokens.push(identifier[0]); position += identifier[0].length; continue; }
    if (number) { tokens.push(number[0]); position += number[0].length; continue; }
    if ("+-*/^()".includes(expression[position])) { tokens.push(expression[position]); position += 1; continue; }
    throw new Error("Carácter no permitido «" + expression[position] + "» en la posición " + (position + 1) + ".");
  }

  // Validacion de inico con un operando, paréntesis o menos unario.
  if (!(isOperand(tokens[0]) || tokens[0] === "(" || tokens[0] === "-")) {
    throw new Error("La expresión debe comenzar con un operando, un paréntesis o un signo menos unario.");
  }
  return tokens;
}

/** Convierte infija a postfija con una pila de operadores. */
function toPostfix(tokens) {
  const output = []; // Cola de salida en notación Polaca inversa.
  const operatorStack = []; // Pila temporal de operadores y paréntesis.
  let expectsOperand = true; // Indica si el siguiente token debe ser un valor.

  // Se recorre cada token en orden y se decide entre salida y pila.
  for (const originalToken of tokens) {
    if (isOperand(originalToken)) {
      if (!expectsOperand) throw new Error("Falta un operador antes de «" + originalToken + "».");
      output.push(originalToken);
      expectsOperand = false;
      continue;
    }
    if (originalToken === "(") {
      if (!expectsOperand) throw new Error("Falta un operador antes del paréntesis de apertura.");
      operatorStack.push("(");
      expectsOperand = true;
      continue;
    }
    if (originalToken === ")") {
      if (expectsOperand) throw new Error("Hay un paréntesis vacío o falta un operando antes de «)».");
      let foundOpeningParenthesis = false;
      // Saca operadores hasta encontrar el paréntesis de apertura asociado.
      while (operatorStack.length > 0) {
        const top = operatorStack.pop();
        if (top === "(") { foundOpeningParenthesis = true; break; }
        output.push(top);
      }
      if (!foundOpeningParenthesis) throw new Error("Hay un paréntesis de cierre sin pareja.");
      expectsOperand = false;
      continue;
    }

    let operator = originalToken;
    if (expectsOperand) {
      if (operator !== "-") throw new Error("El operador «" + operator + "» necesita operando a su izquierda.");
      operator = "u-"; // Token interno distinto para negar un solo operando.
      // El signo prefijo espera a su operando; no debe sacar una potencia pendiente.
      operatorStack.push(operator);
      continue;
    } else {
      expectsOperand = true;
    }
    const incoming = OPERATORS[operator];
    if (!incoming) throw new Error("Operador no admitido: " + operator);

    // Compara prioridades; igualdad también extrae si el operador entrante asocia a izquierda.
    while (operatorStack.length > 0 && operatorStack[operatorStack.length - 1] !== "(") {
      const top = OPERATORS[operatorStack[operatorStack.length - 1]];
      const shouldPop = incoming.associativity === "left"
        ? incoming.precedence <= top.precedence
        : incoming.precedence < top.precedence;
      if (!shouldPop) break;
      output.push(operatorStack.pop());
    }
    operatorStack.push(operator);
  }

  if (expectsOperand) throw new Error("La expresión termina con un operador; falta un operando.");
  // Vacía la pila. Un paréntesis sobrante produce un error entendible.
  while (operatorStack.length > 0) {
    const operator = operatorStack.pop();
    if (operator === "(") throw new Error("Hay un paréntesis de apertura sin pareja.");
    output.push(operator);
  }
  return output;
}

/** Genera código de tres direcciones y cuádruplos de la postfija. */
function buildIntermediateCode(postfixTokens) {
  const valueStack = []; // Operandos y temporales todavía disponibles.
  const instructions = []; // Líneas de código de tres direcciones.
  const quadruples = []; // Objetos con operador, dos argumentos y resultado.
  let temporaryNumber = 1; // Contador para nombrar T1, T2, ...

  // Un operando entra a pila; un operador consume uno o dos valores.
  for (const token of postfixTokens) {
    const operator = OPERATORS[token];
    if (!operator) { valueStack.push(token); continue; }
    const right = valueStack.pop();
    const left = operator.arity === 2 ? valueStack.pop() : null;
    if (right === undefined || (operator.arity === 2 && left === undefined)) {
      throw new Error("La expresión no tiene suficientes operandos para un operador.");
    }
    const temporary = "T" + temporaryNumber;
    temporaryNumber += 1;
    if (operator.arity === 1) {
      instructions.push(temporary + " = -" + right);
      quadruples.push({ operator: "uminus", argument1: right, argument2: "—", result: temporary });
    } else {
      instructions.push(temporary + " = " + left + " " + token + " " + right);
      quadruples.push({ operator: token, argument1: left, argument2: right, result: temporary });
    }
    valueStack.push(temporary);
  }
  if (valueStack.length !== 1) throw new Error("La expresión no forma una operación completa.");
  return { instructions, quadruples, finalValue: valueStack[0] };
}

/** Pinta las salidas usando texto, sin interpretar la entrada como HTML. */
function renderResults(expression, postfixTokens, result) {
  rpnOutput.textContent = postfixTokens.map((token) => token === "u-" ? "NEG" : token).join(" ");
  tacOutput.replaceChildren();
  if (result.instructions.length === 0) {
    const empty = document.createElement("li");
    empty.className = "empty-state";
    empty.textContent = "No hay operaciones: el resultado es " + result.finalValue + ".";
    tacOutput.append(empty);
  } else {
    // Cada elemento muestra una instrucción y el CSS añade su número temporal.
    for (const instruction of result.instructions) {
      const item = document.createElement("li");
      item.textContent = instruction;
      tacOutput.append(item);
    }
  }
  quadOutput.replaceChildren();
  // Cada vuelta crea una fila y cinco celdas: índice y cuatro campos.
  result.quadruples.forEach((quadruple, index) => {
    const row = document.createElement("tr");
    [index + 1, quadruple.operator, quadruple.argument1, quadruple.argument2, quadruple.result].forEach((value) => {
      const cell = document.createElement("td");
      cell.textContent = value;
      row.append(cell);
    });
    quadOutput.append(row);
  });
  statusOutput.textContent = "Expresión: " + expression;
  renderWalkthrough(result.instructions);
}

/** Crea una explicación breve en el orden real de evaluación. */
function renderWalkthrough(instructions) {
  walkthroughContent.replaceChildren();
  const intro = document.createElement("p");
  intro.className = "walkthrough-intro";
  intro.textContent = instructions.length
    ? "La expresión se reduce según paréntesis y precedencia. Cada paso guarda su resultado en un temporal."
    : "La entrada es un solo operando, así que no hacen falta operaciones ni temporales.";
  walkthroughContent.append(intro);
  if (instructions.length === 0) return;
  const list = document.createElement("ol");
  list.className = "walkthrough-list";
  // La explicación usa el mismo orden que las instrucciones generadas.
  instructions.forEach((instruction, index) => {
    const item = document.createElement("li");
    const code = document.createElement("code");
    const explanation = document.createElement("span");
    code.textContent = instruction;
    explanation.textContent = index === instructions.length - 1
      ? "Esta instrucción produce el resultado final."
      : "Se evalúa ahora; su resultado queda disponible para los pasos siguientes.";
    item.append(code, explanation);
    list.append(item);
  });
  walkthroughContent.append(list);
}

/** Reconoce variables o números que cumplen la sintaxis admitida. */
function isOperand(token) {
  return typeof token === "string" &&
    (/^[A-Za-z_][A-Za-z0-9_]*$/.test(token) || /^(?:\d+(?:\.\d*)?|\.\d+)$/.test(token));
}

/** Enseña un error, marca el campo inválido y lo enfoca. */
function showError(message) {
  errorMessage.textContent = message;
  errorMessage.hidden = false;
  expressionInput.setAttribute("aria-invalid", "true");
  expressionInput.focus();
}

/** Borra el error anterior antes de cada intento. */
function hideError() {
  errorMessage.textContent = "";
  errorMessage.hidden = true;
  expressionInput.removeAttribute("aria-invalid");
}

// Ejecuta el ejemplo inicial para que la página muestre resultados al abrir.
form.requestSubmit();
