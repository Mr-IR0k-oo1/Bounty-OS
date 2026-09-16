#include <stdio.h>
#include <stdlib.h>

void execute(char *input) {
    char command[256];
    snprintf(command, sizeof(command), "ping %s", input);
    system(command);
}
