package com.agri.trace;

import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

@Component
public class BatchStateInitializer implements CommandLineRunner {
  private final BatchStateService states;

  public BatchStateInitializer(BatchStateService states) {
    this.states = states;
  }

  @Override
  public void run(String... args) {
    int n = states.refreshAll();
    System.out.println("[agri] batch state machine refreshed " + n + " batches");
  }
}
