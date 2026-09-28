package com.omnirest.omnirest_backend.dtos;

import java.util.List;

public record MenuCategoryDTO(
    String category,
    List<String> items
) {}
