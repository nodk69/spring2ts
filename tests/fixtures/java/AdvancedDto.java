package com.example.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.annotation.JsonAlias;
import java.util.Optional;

public class AdvancedDto extends UserDto {
    
    @JsonProperty("phone_number")
    @JsonAlias({"phone", "mobile"})
    private String phoneNumber;
    
    private Optional<String> middleName;
    
    @NotNull
    private String requiredField;
}
