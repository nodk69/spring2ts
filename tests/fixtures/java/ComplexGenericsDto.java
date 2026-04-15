package com.example.dto;

import java.util.*;

public class ComplexGenericsDto {
    private Map<String, List<Map<Integer, Set<String>>>> deeplyNested;
    private List<Optional<Map<String, Object>>> complexList;
    private Optional<List<Optional<String>>> optionalList;
}
