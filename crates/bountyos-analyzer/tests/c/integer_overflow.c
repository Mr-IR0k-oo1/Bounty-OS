#include <stdlib.h>

void *allocate_array(int count, int elem_size) {
    int total = count * elem_size;
    return malloc(total);
}
