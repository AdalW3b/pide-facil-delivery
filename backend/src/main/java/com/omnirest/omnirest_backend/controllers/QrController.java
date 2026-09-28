package com.omnirest.omnirest_backend.controllers;

import com.omnirest.omnirest_backend.services.TableService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor
public class QrController {

    private final TableService tableService;

    @GetMapping("/api/v1/qr/{qrToken}")
    public ResponseEntity<Void> redirectToWhatsapp(@PathVariable String qrToken) {
        return tableService.getRedirectUrlByQrToken(qrToken)
                .map(url -> ResponseEntity.status(HttpStatus.FOUND)
                        .header(HttpHeaders.LOCATION, url)
                        .<Void>build())
                .orElse(ResponseEntity.notFound().build());
    }
}
