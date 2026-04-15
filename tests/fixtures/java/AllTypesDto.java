package com.example.dto;

import java.time.*;
import java.math.*;
import java.util.*;

public class AllTypesDto {
    // Primitives
    private int intField;
    private long longField;
    private double doubleField;
    private float floatField;
    private boolean booleanField;
    private byte byteField;
    private short shortField;
    private char charField;
    
    // Wrappers
    private Integer integerField;
    private Long longWrapperField;
    private Double doubleWrapperField;
    private Float floatWrapperField;
    private Boolean booleanWrapperField;
    private Byte byteWrapperField;
    private Short shortWrapperField;
    private Character characterField;
    
    // Common types
    private String stringField;
    private BigDecimal bigDecimalField;
    private BigInteger bigIntegerField;
    private UUID uuidField;
    
    // Date/Time
    private LocalDate localDateField;
    private LocalDateTime localDateTimeField;
    private LocalTime localTimeField;
    private Date dateField;
    private Instant instantField;
    private ZonedDateTime zonedDateTimeField;
    
    // Collections
    private List<String> stringList;
    private Set<Integer> integerSet;
    private Map<String, Object> stringObjectMap;
    private String[] stringArray;
    
    // Optional
    private Optional<String> optionalString;
    private Optional<LocalDateTime> optionalDateTime;
    
    // Nested generics
    private List<Optional<String>> listOfOptionalStrings;
    private Map<String, List<Integer>> mapOfLists;
}
