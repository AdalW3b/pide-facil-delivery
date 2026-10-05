package com.omnirest.omnirest_backend.config;

import com.omnirest.omnirest_backend.security.CandadoSoporte;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/** Interceptores de la API. */
@Configuration
@RequiredArgsConstructor
public class MvcConfig implements WebMvcConfigurer {

    private final CandadoSoporte candadoSoporte;

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(candadoSoporte).addPathPatterns("/api/v1/**");
    }
}
