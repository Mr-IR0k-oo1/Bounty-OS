#include <stdlib.h>
#include <string.h>

void execute_fixed(const char *input) {
    if (strcmp(input, "check") == 0) {
        system("/usr/bin/uptime");
    }
}
