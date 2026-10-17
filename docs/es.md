# Xiaomi TV

## Presentación

Esta integración lleva su **televisor Xiaomi** a Gladys: encenderlo o ponerlo en espera, ajustar el volumen, pulsar las teclas del mando, abrir sus aplicaciones y cambiar la entrada HDMI, desde el panel y desde sus escenas.

Funciona con los televisores Xiaomi con **MIUI TV / PatchWall**, que responden en el puerto 6095 de la red local (la API que usa la app Mi Remote). Todo se queda en su **red local**: sin cuenta, sin emparejamiento, sin nube. **Los modelos Android TV y Google TV** (Mi TV P1, Q1, Q2, Xiaomi TV A / A Pro…) **no tienen este puerto**: esta integración no puede controlarlos.

## Requisitos

- Gladys Assistant 5.2.0 o posterior.
- Un televisor Xiaomi con MIUI TV / PatchWall, encendido y conectado a la **misma red que Gladys**. Para comprobarlo: abra `http://<dirección del televisor>:6095/request?action=isalive` en un navegador; el televisor responde con su nombre.
- En la pantalla de instalación, acepte la **detección de red** (SSDP), que permite a Gladys encontrar los televisores, y el **Wake-on-LAN**, que permite a la integración encender un televisor que ya no responde.

## Configuración

### Búsqueda

En la mayoría de los hogares no hay nada que rellenar: encienda el televisor y pulse **Buscar y probar los televisores**. El mensaje lista cada televisor encontrado con su dirección, su dirección MAC y si responde.

Un televisor que la búsqueda no encuentra (otra subred, una red que filtra el multicast): escriba su dirección en **Direcciones IP**, separadas por comas, y guarde.

Asigne al televisor una **dirección IP fija** en su router: la integración vuelve a encontrar un televisor cuya dirección ha cambiado (por su dirección MAC), pero antes con una dirección fija.

### Actualización e idioma

- **Actualización del estado**: se pregunta a cada televisor si responde y cuál es su volumen cada 10 segundos (por defecto), 30 segundos o 1 minuto.
- **Búsqueda automática**: la red se vuelve a explorar cada hora (por defecto), cada 15 minutos o nunca; un televisor que deja de responder lanza una búsqueda de todos modos.
- **Idioma de los textos de los dispositivos**: los nombres de las funciones en la pestaña Descubrir y los mensajes de error de las escenas se escriben en este idioma, porque Gladys no les envía el suyo.

## Uso

### Dispositivos

Abra la pestaña **Descubrir** de la integración: aparece cada televisor encontrado. Añádalo y cámbiele el nombre a su gusto. Un televisor tiene estas funciones:

- **Encendido/espera**: la tecla de encendido del mando.
- **Volumen**: un control deslizante de 0 al máximo del televisor.
- **Subir volumen**, **Bajar volumen**, **Silenciar**, **Arriba**, **Abajo**, **Izquierda**, **Derecha**, **Aceptar**, **Menú**, **Volver**: botones del mando.

La insignia del televisor muestra **local**, o **inaccesible** cuando no responde.

**El estado de encendido es supuesto.** La tecla de encendido alterna el televisor entre encendido y espera, y un televisor en espera sigue respondiendo en la red: la integración no puede distinguirlos. Así que el estado es la última orden enviada desde Gladys, **encendido** cuando el televisor vuelve a responder, **apagado** cuando deja de responder. Si lo pone en espera con su propio mando, Gladys lo sigue mostrando encendido: pulse el botón dos veces para resincronizar. Encender un televisor que no responde envía un **Wake-on-LAN** cuando se conoce su dirección MAC.

El televisor no tiene tecla de silencio: **Silenciar** baja el volumen a 0, y otra pulsación restablece el volumen anterior. El volumen se alcanza con las teclas de volumen (la petición directa del televisor exige una firma que no es pública): un cambio grande tarda unos segundos.

### Widgets

![El widget «Televisor Xiaomi»: el televisor del salón encendido, volumen 18, sus seis primeras aplicaciones con su nombre de paquete y cuatro botones; el televisor del dormitorio que no responde, con su botón Encender (ilustración generada, no una captura de pantalla)](https://raw.githubusercontent.com/William-De71/gladys-xiaomi-tv/main/docs/assets/widgets.es.png)

**Televisor Xiaomi**: un televisor elegido en los ajustes, con su estado, su dirección, su volumen, sus seis primeras aplicaciones (icono, nombre y nombre de paquete) y cuatro botones: **En espera** / **Encender**, **Inicio**, **Silenciar** / **Activar sonido** y **Abrir una app**, que abre un formulario con todas las aplicaciones del televisor. Cuando el televisor no responde, solo queda **Encender** (si el Wake-on-LAN es posible).

### Acciones de escena

- **Abrir una app en un televisor Xiaomi**: el nombre de la aplicación tal como aparece en el televisor (`Netflix`, `YouTube`; mayúsculas y acentos dan igual) o su nombre de paquete (`com.netflix.ninja`, listado por el widget). Pasa `app_name` y `package` a las acciones siguientes.
- **Pulsar teclas de un televisor Xiaomi**: hasta 30 teclas separadas por comas (`home, down, down, enter`) entre `power`, `up`, `down`, `left`, `right`, `enter`, `home`, `back`, `menu`, `volumeup`, `volumedown`, con una pausa entre ellas (700 ms por defecto). Pasa `keys_sent`.
- **Cambiar la entrada de un televisor Xiaomi**: HDMI 1, HDMI 2 o HDMI 3.

La integración no tiene disparador de escena: el televisor no envía ningún evento. Para lanzar una escena cuando se enciende el televisor, use el disparador de Gladys «Cambio de estado del dispositivo» en su función **Encendido/espera**.

### Ejemplos de escenas

- Cada noche a las 20:30, si hay alguien en casa → **Abrir una app en un televisor Xiaomi** `Netflix`, y luego las luces del salón al 20 %.
- **El estado Encendido/espera del televisor pasa a 1** → cerrar las persianas del salón y atenuar las luces.
- Cuando se enciende la consola → **Cambiar la entrada de un televisor Xiaomi** a HDMI 2, y luego el volumen a 30.

## Solución de problemas

- **No se encuentra ningún televisor**: compruebe que está encendido, en la misma red que Gladys (no una red de invitados) y que `http://<dirección del televisor>:6095/request?action=isalive` responde en un navegador. Si no, su modelo no tiene esta API (modelos Android TV y Google TV). Si responde, escriba su dirección en la configuración.
- **«Gladys rechazó la búsqueda en la red»**: reinstale la integración aceptando su detección de red, o escriba la dirección del televisor.
- **El televisor aparece encendido cuando está en espera** (o al revés): el estado es supuesto, ver arriba. Pulse Encendido/espera dos veces.
- **El televisor no se enciende desde la espera o apagado**: en espera profunda, algunos televisores ignoran el Wake-on-LAN; enciéndalo con su mando. Un televisor encontrado solo por su dirección escrita no tiene dirección MAC conocida: sin Wake-on-LAN.
- **El volumen no cambia**: puede que el sonido salga por un equipo de audio externo (HDMI ARC, óptico) cuyo volumen el televisor no controla.
- **Una aplicación no se abre**: compruebe su nombre en el widget, o use su nombre de paquete.
- Registros: la pestaña Registros de la integración; añada `DEBUG=gladys-integration-sdk` al contenedor para ver el detalle. Informe de un problema en [GitHub](https://github.com/William-De71/gladys-xiaomi-tv/issues) con su versión de Gladys, la versión de la integración, el modelo del televisor y los registros.
