package com.example.dto;

import java.io.Serializable;

public class EdgeCasesDto implements Serializable {
    // Reserved words
    private String class;
    private String interface;
    private String enum;
    
    // Special characters in JSON
    @JsonProperty("field-name")
    private String fieldName;
    
    @JsonProperty("field.name")
    private String fieldDotName;
    
    // Very long field name
    private String thisIsAVeryLongFieldNameThatShouldStillWorkCorrectly;
    
    // Multiple fields same line
    private int x, y, z;
    
    // Static field (should be ignored)
    private static final String CONSTANT = "value";
    
    // Transient field
    private transient String tempField;
}
