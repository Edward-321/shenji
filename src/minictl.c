#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/utsname.h>
#include <unistd.h>

int main(int argc, char **argv) {
    struct utsname u;

    if (argc > 1 && strcmp(argv[1], "-v") == 0) {
        printf("minictl 1.0.0 (GitHub Actions / macOS runner build)\n");
        exit(0);
    }

    printf("=== minictl ===\n");
    if (uname(&u) == 0) {
        printf("sysname : %s\n", u.sysname);
        printf("release : %s\n", u.release);
        printf("machine : %s\n", u.machine);
        printf("version : %s\n", u.version);
    } else {
        printf("uname failed\n");
    }
    printf("uid     : %d\n", (int)getuid());
    printf("pid     : %d\n", (int)getpid());
    printf("\n[ok] built on GitHub Actions macos-14 runner\n");

    exit(0);
}