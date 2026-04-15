package com.example.dto.complex;

import java.util.Map;
import java.util.Set;

public class NestedDto {
    private String name;
    private Map<String, Integer> scores;
    private Set<String> tags;
    private List<Map<String, Object>> complexList;
}
