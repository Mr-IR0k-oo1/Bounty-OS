#include <stdlib.h>

void init_buffer(size_t size) {
    char *buf = malloc(size);
    buf[0] = '\0';
}
