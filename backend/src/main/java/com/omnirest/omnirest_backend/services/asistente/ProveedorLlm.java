package com.omnirest.omnirest_backend.services.asistente;

import java.util.List;
import java.util.Map;

/**
 * Un proveedor de IA (Claude, OpenAI, Gemini o uno compatible con OpenAI)
 * visto de forma neutral: el asistente no sabe con cuál habla.
 *
 * Cada conversación guarda su historial en el formato nativo de su proveedor
 * (así se conservan, por ejemplo, los bloques de razonamiento de Claude) y
 * solo expone pasos: el modelo responde con texto o pide herramientas.
 */
public interface ProveedorLlm {

    /** Una herramienta que el modelo puede pedir. {@code parametros} es un JSON Schema de tipo objeto. */
    record Herramienta(String nombre, String descripcion, Map<String, Object> parametros) {
    }

    /** Un turno anterior de la plática, solo texto. */
    record Turno(boolean delUsuario, String texto) {
    }

    /** El modelo pidió ejecutar una herramienta. Los argumentos vienen como JSON. */
    record Llamada(String id, String nombre, String argumentosJson) {
    }

    /** Lo que regresó la herramienta, como JSON o texto. */
    record Resultado(Llamada llamada, String contenido, boolean esError) {
    }

    /** Una respuesta del modelo: texto final o herramientas por ejecutar. */
    record Paso(String texto, List<Llamada> llamadas, long tokensEntrada, long tokensSalida) {
        public boolean pideHerramientas() {
            return llamadas != null && !llamadas.isEmpty();
        }
    }

    /** Una plática en curso con su historial nativo. */
    interface Conversacion {
        /** Manda lo acumulado y regresa la respuesta del modelo. */
        Paso siguiente();

        /** Agrega los resultados de las herramientas que pidió el último paso. */
        void responder(List<Resultado> resultados);
    }

    /**
     * Empieza una plática. {@code instrucciones} es lo fijo (se puede guardar en
     * caché del proveedor); {@code contexto} lo de este restaurante y momento.
     */
    Conversacion iniciar(String instrucciones, String contexto, List<Turno> historial, String pregunta,
                         List<Herramienta> herramientas, int maxTokens);
}
