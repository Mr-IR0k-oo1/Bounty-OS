#include <stdio.h>
#include <string.h>

void copy_bounded(const char *input) {
    char buffer[64];
    snprintf(buffer, sizeof(buffer), "%s", input);
}
