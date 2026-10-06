package com.omnirest.omnirest_backend.services.asistente;

import java.net.InetAddress;
import java.net.URI;
import java.net.UnknownHostException;

/**
 * La dirección de un servicio compatible con OpenAI la escribe el dueño, y el
 * servidor la llama. Sin este filtro alguien podría usar el asistente para
 * llegar a la red interna del servidor (la base, otros servicios). Solo se
 * acepta https hacia direcciones públicas.
 */
final class UrlSegura {

    private UrlSegura() {
    }

    static String exigir(String url) {
        if (url == null || url.isBlank()) {
            throw new IllegalArgumentException("Escribe la URL del servicio (por ejemplo https://api.deepseek.com/v1).");
        }
        URI uri;
        try {
            uri = URI.create(url.trim());
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("La URL no es válida.");
        }
        if (!"https".equalsIgnoreCase(uri.getScheme()) || uri.getHost() == null) {
            throw new IllegalArgumentException("La URL tiene que empezar con https://");
        }
        if (uri.getUserInfo() != null) {
            throw new IllegalArgumentException("La URL no puede llevar usuario ni contraseña.");
        }
        try {
            for (InetAddress ip : InetAddress.getAllByName(uri.getHost())) {
                if (ip.isLoopbackAddress() || ip.isSiteLocalAddress() || ip.isLinkLocalAddress()
                        || ip.isAnyLocalAddress() || ip.isMulticastAddress() || esPrivadaV6(ip)) {
                    throw new IllegalArgumentException("La URL apunta a una red privada. Usa la dirección pública del servicio.");
                }
            }
        } catch (UnknownHostException e) {
            throw new IllegalArgumentException("No se encontró el servidor " + uri.getHost() + ".");
        }
        return uri.toString().replaceAll("/+$", "");
    }

    /** fc00::/7 (direcciones únicas locales de IPv6). */
    private static boolean esPrivadaV6(InetAddress ip) {
        byte[] b = ip.getAddress();
        return b.length == 16 && (b[0] & 0xFE) == 0xFC;
    }
}
