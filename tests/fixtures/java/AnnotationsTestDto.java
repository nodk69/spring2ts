package com.example.dto;

import com.fasterxml.jackson.annotation.*;

public class AnnotationsTestDto {
    
    @JsonProperty("custom_name")
    private String renamedField;
    
    @JsonAlias({"alias1", "alias2", "alias3"})
    private String aliasedField;
    
    @NotNull
    private String requiredField;
    
    @Nullable
    private String nullableField;
    
    @JsonProperty("nested_name")
    @JsonAlias({"nested_alias"})
    @NotNull
    private String combinedAnnotations;
}
