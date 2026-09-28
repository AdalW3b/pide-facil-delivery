package com.omnirest.omnirest_backend;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class OmnirestBackendApplication {

	public static void main(String[] args) {
		SpringApplication.run(OmnirestBackendApplication.class, args);
	}
}
