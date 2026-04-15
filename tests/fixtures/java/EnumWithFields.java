package com.example.dto;

public enum EnumWithFields {
    PENDING("Pending"),
    ACTIVE("Active"),
    DELETED("Deleted");
    
    private final String displayName;
    
    EnumWithFields(String displayName) {
        this.displayName = displayName;
    }
    
    public String getDisplayName() {
        return displayName;
    }
}
