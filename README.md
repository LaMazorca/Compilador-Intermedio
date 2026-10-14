# Práctica 1: compilador intermedio
## Lenguajes y Automatas II
### Instituto Tecnologico Superior de Progreso

Transforma expresiones aritméticas a Polaca inversa, código de tres direcciones y cuádruplos. Solo usa HTML, CSS y JavaScript vanilla: no requiere instalar paquetes.

## Ejemplo usado

Entrada: a+b*c+d

- Polaca inversa: a b c * + d +
- Tres direcciones: T1 = b * c; T2 = a + T1; T3 = T2 + d
- Cuádruplos: (*, b, c, T1), (+, a, T1, T2), (+, T2, d, T3)

## Reglas y límites

Se aceptan identificadores de letras, dígitos y guion bajo (empezando por letra o guion bajo), enteros, decimales con punto, paréntesis y operadores + - * / ^. Precedencia: paréntesis, potencia, menos unario, multiplicación/división, suma/resta. Potencias agrupan a la derecha; el resto de operadores binarios de igual nivel agrupa a la izquierda.

No se evalúa el valor de variables. No hay multiplicación implícita (escribe 2*x), funciones, asignaciones, notación científica ni nombres Unicode. Se detectan entrada vacía, símbolos inesperados, operandos u operadores faltantes, paréntesis desbalanceados y expresiones incompletas. No se puede diagnosticar división por cero porque el sitio transforma la expresión pero no calcula valores.

## Explicación del código

### index.html

Declara la estructura de la interfaz. El formulario expression-form inicia la transformación. El campo expression contiene la entrada; error-message anuncia errores. rpn-output, tac-output y quad-output reciben Polaca inversa, tres direcciones y cuádruplos. walkthrough-content muestra pasos didácticos, y result-status indica la expresión transformada. 

### script.js: operadores y elementos

OPERATORS es un objeto con una entrada por operador. precedence es su prioridad (un número mayor significa más prioridad); associativity indica si se agrupa a izquierda o derecha; arity es el número de operandos. u- es un símbolo interno para distinguir menos unario (-a) de resta binaria (a-b).

### Evento del formulario

El manejador submit llama a event.preventDefault() para impedir la recarga de la página. Quita el error anterior, lee expression, llama en orden a tokenize, toPostfix y buildIntermediateCode y, si todo es correcto, llama a renderResults. El bloque try/catch convierte errores de análisis en mensajes entendibles mediante showError. La página actualiza los resultados después del procesamiento exitoso, no a mitad de un procesamiento fallido. El botón de ejemplo cambia el campo a a+b*c+d y llama form.requestSubmit(), reutilizando el mismo proceso. 

### tokenize(expression)

Separa la expresión en tokens: operandos, operadores y paréntesis. tokens es el arreglo de salida y position es el índice del carácter actual.

El ciclo while continúa mientras position sea menor que la longitud de la expresión. remaining es el texto aún no examinado. Primero se detectan espacios; luego identificadores (letra o guion bajo al inicio, después también dígitos); luego números enteros/decimales; y finalmente los operadores y paréntesis. La coincidencia se agrega a tokens y position avanza por la cantidad de caracteres consumidos. continue salta a la siguiente vuelta cuando se reconoció un espacio, variable o número. Si ningún patrón reconoce el carácter, se lanza un error con su posición.

La función devuelve tokens. La comprobación de inicio permite operandos, paréntesis o menos unario. Las demás combinaciones se validan en toPostfix.

### toPostfix(tokens)

Convierte notación infija (operadores entre operandos) a postfija mediante dos arreglos. output acumula la salida; operatorStack contiene operadores todavía no emitidos; expectsOperand indica si se espera un operando.

El ciclo for...of visita cada token. Un operando se agrega a output; si ya no se esperaba operando, falta un operador entre los dos valores. Un paréntesis de apertura se apila. Al cerrar paréntesis, el ciclo while extrae operadores hasta la apertura; foundOpeningParenthesis recuerda si encontró la pareja. Un cierre sin pareja y un cierre después de operador producen errores.

Un signo menos cuando se espera un operando se convierte a u- y se apila sin sacar potencia pendiente; así se interpretan correctamente a^-b y -a^2. En cambio, el menos después de un operando es resta binaria. Para operadores binarios, el ciclo while compara la prioridad entrante con la de la cima: un operador entrante de asociación izquierda extrae operadores de prioridad igual o mayor; uno de asociación derecha solo extrae prioridad mayor. Esto hace que potencia se agrupe a la derecha.

Al final, expectsOperand verdadero indica que faltó el último operando. El while final vacía operadores; encontrar una apertura significa que faltó cierre. La función devuelve output.

### buildIntermediateCode(postfixTokens)

Interpreta la postfija. valueStack guarda operandos y temporales pendientes; instructions guarda código de tres direcciones; quadruples guarda filas con los campos operador, argumento 1, argumento 2 y resultado. temporaryNumber cuenta T1, T2, etcétera.

El ciclo for...of examina cada token. Un token que no es operador se apila. Al encontrar operador, right se extrae de la pila; para uno binario también se extrae left. operator.arity determina si hacen falta uno o dos argumentos. Tras validar que existan, se crea el temporal y se incrementa su contador. Se añade una instrucción y un cuádruplo, y el temporal se vuelve a apilar para que la operación siguiente pueda utilizarlo.

Al recorrer la postfija, cada operador aparece cuando sus operandos ya están disponibles, así que se emiten instrucciones en orden de evaluación. Al final tiene que quedar un solo valor en valueStack. finalValue contiene ese resultado simbólico; sirve, por ejemplo, si la entrada fue solo x.

### Renderizado

renderResults actualiza la salida postfija y vacía/reconstruye las listas. Si no hay operaciones, se informa que la entrada era un único operando. El ciclo for...of crea una línea por instrucción. El ciclo forEach crea una fila por cuádruplo y una celda por campo. Se usa textContent en vez de interpretar HTML para mostrar la entrada con seguridad.

renderWalkthrough reconstruye la explicación en el mismo orden que las instrucciones. El ciclo forEach crea el texto de cada paso; el último se identifica como resultado final.

### Funciones auxiliares

isOperand prueba si el token corresponde a un identificador o número permitido.

showError recibe el texto, muestra la alerta, marca el campo inválido y lo enfoca.

hideError borra el mensaje y la marca inválida antes del siguiente intento.

### Algunos ejemplos para explorar el programa

- a+b*c+d → a b c * + d +
- (a+b)*c → a b + c *
- a-b-c → a b - c -
- a^b^c → a b c ^ ^
- -a^2 → a 2 ^ NEG
- a^-b → a b NEG ^
- a+ o (a+b → mensaje de error
