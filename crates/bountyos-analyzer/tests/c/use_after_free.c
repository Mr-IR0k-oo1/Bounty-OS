#include <stdlib.h>

void process(void) {
    char *buffer = malloc(64);

    free(buffer);

    buffer[0] = 'A';
}
