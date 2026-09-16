#include <stdio.h>

void build_query(char *query, size_t max, const char *username) {
    snprintf(query, max, "SELECT * FROM users WHERE name = '%s'", username);
}
