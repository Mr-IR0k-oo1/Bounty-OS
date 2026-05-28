use colored::*;
use serde::Serialize;
use tabled::{Table, Tabled};

pub fn print_table<T: Tabled>(items: Vec<T>) {
    if items.is_empty() {
        println!("{}", "No results.".yellow());
        return;
    }
    let table = Table::new(items);
    println!("{}", table);
}

pub fn print_json<T: Serialize>(item: &T) {
    match serde_json::to_string_pretty(item) {
        Ok(json) => println!("{}", json),
        Err(e) => print_error(&format!("JSON serialization error: {}", e)),
    }
}

pub fn print_error(msg: &str) {
    eprintln!("{} {}", "[ERROR]".red().bold(), msg);
}

pub fn print_success(msg: &str) {
    println!("{} {}", "[OK]".green().bold(), msg);
}
