package com.omnirest.omnirest_backend;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class OmnirestBackendApplication {

	public static void main(String[] args) {
		// Todas las horas del sistema son de Mexico: el reporte "de hoy", la
		// vigencia de las promociones, los cortes de caja. En un servidor en UTC,
		// sin esto, el dia cambiaba a las 6 de la tarde. Se puede cambiar con la
		// variable APP_ZONA_HORARIA (p. ej. America/Tijuana).
		String zona = System.getenv().getOrDefault("APP_ZONA_HORARIA", "America/Mexico_City");
		java.util.TimeZone.setDefault(java.util.TimeZone.getTimeZone(zona));
		SpringApplication.run(OmnirestBackendApplication.class, args);
	}
}
