package com.agri.trace;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@EnableScheduling
@SpringBootApplication
public class AgriTraceApplication {
  public static void main(String[] args) {
    SpringApplication.run(AgriTraceApplication.class, args);
  }
}
