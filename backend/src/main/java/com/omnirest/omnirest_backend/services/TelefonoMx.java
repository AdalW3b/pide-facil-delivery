package com.omnirest.omnirest_backend.services;

/**
 * Deja un telefono mexicano en una sola forma, para poder compararlo.
 *
 * El mismo celular se escribe de varias maneras y todas circulan a la vez:
 * WhatsApp entrega "5219531403282", la gente teclea "+52 953 140 3282" y a
 * veces solo los diez digitos. Si se comparan tal cual, la misma persona queda
 * registrada dos veces y los reportes se parten.
 *
 * La forma canonica es 52 + los diez digitos nacionales.
 */
public final class TelefonoMx {

    /** Codigo de pais de Mexico. */
    private static final String MX = "52";
    private static final int DIGITOS_NACIONALES = 10;

    private TelefonoMx() {
    }

    /**
     * Devuelve el telefono en su forma canonica, o cadena vacia si viene nulo o
     * sin digitos. Un numero que no parece mexicano se deja solo con sus
     * digitos: es mejor conservarlo tal cual que forzarlo a un formato ajeno.
     */
    public static String canonico(String telefono) {
        if (telefono == null) {
            return "";
        }

        String digitos = telefono.replaceAll("\\D", "");
        if (digitos.isEmpty()) {
            return "";
        }

        // "521" + 10 digitos: el 1 que WhatsApp antepone a los celulares
        // mexicanos. Sobra para identificar a la persona.
        if (digitos.length() == MX.length() + 1 + DIGITOS_NACIONALES && digitos.startsWith(MX + "1")) {
            return MX + digitos.substring(MX.length() + 1);
        }

        // Diez digitos sueltos: es un numero nacional, se le pone el pais.
        if (digitos.length() == DIGITOS_NACIONALES) {
            return MX + digitos;
        }

        return digitos;
    }

    /** True si los dos textos apuntan al mismo telefono. */
    public static boolean mismoNumero(String uno, String otro) {
        String a = canonico(uno);
        return !a.isEmpty() && a.equals(canonico(otro));
    }
}
